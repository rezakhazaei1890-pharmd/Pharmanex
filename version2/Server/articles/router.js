
import express from "express";

const router = express.Router();

const TIMEOUT = 20000;

async function getJSON(url) {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(TIMEOUT),
    headers: {
      Accept: "application/json"
    }
  });

  if (!response.ok) {
    throw new Error(`Source error: ${response.status}`);
  }

  return response.json();
}

// Europe PMC
async function searchEuropePMC(query, limit) {
  const url = new URL(
    "https://www.ebi.ac.uk/europepmc/webservices/rest/search"
  );

  url.searchParams.set("query", query);
  url.searchParams.set("format", "json");
  url.searchParams.set("resultType", "core");
  url.searchParams.set("pageSize", String(limit));

  const data = await getJSON(url);

  return (data.resultList?.result || []).map(a => ({
    title: a.title || "",
    authors: a.authorString || "",
    journal: a.journalTitle || "",
    year: a.pubYear || "",
    doi: a.doi || "",
    pmid: a.pmid || "",
    pmcid: a.pmcid || "",
    abstract: a.abstractText || "",
    source: "Europe PMC",
    openAccess: a.isOpenAccess === "Y",
    url: a.pmcid
      ? `https://europepmc.org/articles/${a.pmcid}`
      : a.doi
        ? `https://doi.org/${a.doi}`
        : ""
  }));
}

// Crossref
async function searchCrossref(query, limit) {
  const url = new URL("https://api.crossref.org/works");

  url.searchParams.set("query.bibliographic", query);
  url.searchParams.set("rows", String(limit));

  const data = await getJSON(url);

  return (data.message?.items || []).map(a => ({
    title: a.title?.[0] || "",
    authors: (a.author || [])
      .map(x => `${x.given || ""} ${x.family || ""}`.trim())
      .join(", "),
    journal: a["container-title"]?.[0] || "",
    year: a.published?.["date-parts"]?.[0]?.[0] || "",
    doi: a.DOI || "",
    pmid: "",
    pmcid: "",
    abstract: a.abstract || "",
    source: "Crossref",
    openAccess: Boolean(a.license?.length),
    url: a.URL || ""
  }));
}

// OpenAlex
async function searchOpenAlex(query, limit) {
  const url = new URL("https://api.openalex.org/works");

  url.searchParams.set("search", query);
  url.searchParams.set("per-page", String(limit));

  const data = await getJSON(url);

  return (data.results || []).map(a => ({
    title: a.title || "",
    authors: (a.authorships || [])
      .map(x => x.author?.display_name || "")
      .filter(Boolean)
      .join(", "),
    journal: a.primary_location?.source?.display_name || "",
    year: a.publication_year || "",
    doi: (a.doi || "").replace("https://doi.org/", ""),
    pmid: "",
    pmcid: "",
    abstract: "",
    source: "OpenAlex",
    openAccess: Boolean(a.open_access?.is_oa),
    url: a.doi || a.id || ""
  }));
}

// PubMed
async function searchPubMed(query, limit) {
  const searchURL = new URL(
    "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi"
  );

  searchURL.searchParams.set("db", "pubmed");
  searchURL.searchParams.set("term", query);
  searchURL.searchParams.set("retmax", String(limit));
  searchURL.searchParams.set("retmode", "json");

  const searchData = await getJSON(searchURL);

  const ids = searchData.esearchresult?.idlist || [];

  if (!ids.length) return [];

  const summaryURL = new URL(
    "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi"
  );

  summaryURL.searchParams.set("db", "pubmed");
  summaryURL.searchParams.set("id", ids.join(","));
  summaryURL.searchParams.set("retmode", "json");

  const summary = await getJSON(summaryURL);

  return ids.map(id => {
    const a = summary.result?.[id] || {};

    return {
      title: a.title || "",
      authors: (a.authors || [])
        .map(x => x.name)
        .join(", "),
      journal: a.fulljournalname || a.source || "",
      year: a.pubdate || "",
      doi: (a.articleids || [])
        .find(x => x.idtype === "doi")?.value || "",
      pmid: id,
      pmcid: "",
      abstract: "",
      source: "PubMed",
      openAccess: false,
      url: `https://pubmed.ncbi.nlm.nih.gov/${id}/`
    };
  });
}

// Remove duplicate records
function mergeArticles(groups) {
  const records = new Map();

  for (const article of groups.flat()) {
    const key = article.doi
      ? `doi:${article.doi.toLowerCase()}`
      : article.pmid
        ? `pmid:${article.pmid}`
        : `title:${article.title.toLowerCase().trim()}`;

    if (!key || key === "title:") continue;

    if (!records.has(key)) {
      records.set(key, {
        ...article,
        sources: [article.source]
      });
    } else {
      const existing = records.get(key);

      existing.sources.push(article.source);

      for (const field of [
        "abstract",
        "authors",
        "journal",
        "pmid",
        "pmcid",
        "url"
      ]) {
        if (!existing[field] && article[field]) {
          existing[field] = article[field];
        }
      }

      existing.openAccess =
        existing.openAccess || article.openAccess;
    }
  }

  return [...records.values()];
}

// Multi-source search endpoint
router.get("/search", async (req, res) => {
  try {
    const query = String(req.query.q || "").trim();

    const limit = Math.min(
      Math.max(Number(req.query.limit) || 10, 1),
      20
    );

    if (query.length < 3 || query.length > 200) {
      return res.status(400).json({
        error: "عبارت جست‌وجو باید بین ۳ تا ۲۰۰ کاراکتر باشد."
      });
    }

    const results = await Promise.allSettled([
      searchPubMed(query, limit),
      searchEuropePMC(query, limit),
      searchCrossref(query, limit),
      searchOpenAlex(query, limit)
    ]);

    const successful = results
      .filter(x => x.status === "fulfilled")
      .map(x => x.value);

    const articles = mergeArticles(successful);

    return res.json({
      success: true,
      query,
      totalResults: articles.length,
      sources: {
        pubmed: results[0].status === "fulfilled",
        europePMC: results[1].status === "fulfilled",
        crossref: results[2].status === "fulfilled",
        openAlex: results[3].status === "fulfilled"
      },
      articles
    });

  } catch (error) {
    console.error("PHARMANEX search error:", error.message);

    return res.status(502).json({
      error: "جست‌وجوی علمی فعلاً امکان‌پذیر نیست."
    });
  }
});

export default router;
