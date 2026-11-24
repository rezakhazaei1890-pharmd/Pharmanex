
import express from "express";
import { checkArticleLicense } from "./license.js";

const router = express.Router();

const SOURCES = {
  europepmc: "Europe PMC",
  pubmed: "PubMed",
  crossref: "Crossref",
  openalex: "OpenAlex"
};

function clean(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeArticle(article) {
  const licenseUrl = clean(article.licenseUrl);
  const licenseLabel = clean(article.licenseLabel);

  const licenseCheck = checkArticleLicense(licenseUrl);

  return {
    title: clean(article.title) || "عنوان نامشخص",
    authors: clean(article.authors),
    journal: clean(article.journal),
    publicationDate: clean(article.publicationDate),
    doi: clean(article.doi),
    pmid: clean(article.pmid),
    pmcid: clean(article.pmcid),
    abstract: clean(article.abstract),
    sourceUrl: clean(article.sourceUrl),
    sources: article.sources || [],
    license: {
      url: licenseUrl || null,
      label: licenseLabel || null,
      verified: licenseCheck.verified,
      allowedForCommercialTranslation: licenseCheck.allowed,
      status: licenseCheck.allowed
        ? "permitted"
        : licenseCheck.verified
          ? "restricted"
          : "unknown",
      reason: licenseCheck.reason
    }
  };
}

function normalizeDoi(value) {
  return clean(value)
    .toLowerCase()
    .replace(/^https?:\/\/(dx\.)?doi\.org\//, "");
}

function mergeArticles(records) {
  const articles = new Map();

  for (const raw of records) {
    const article = normalizeArticle(raw);

    const key = article.doi
      ? `doi:${normalizeDoi(article.doi)}`
      : article.pmid
        ? `pmid:${article.pmid}`
        : `title:${article.title.toLowerCase()}`;

    if (!articles.has(key)) {
      articles.set(key, article);
      continue;
    }

    const existing = articles.get(key);

    existing.sources = [
      ...new Set([...existing.sources, ...article.sources])
    ];

    for (const field of [
      "abstract",
      "authors",
      "journal",
      "publicationDate",
      "doi",
      "pmid",
      "pmcid",
      "sourceUrl"
    ]) {
      if (!existing[field] && article[field]) {
        existing[field] = article[field];
      }
    }

    if (!existing.license.url && article.license.url) {
      existing.license = article.license;
    }
  }

  return [...articles.values()];
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(15000)
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
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
  url.searchParams.set("pageSize", String(limit));
  url.searchParams.set("resultType", "core");

  const data = await fetchJson(url.toString());

  return (data.resultList?.result || []).map(item => ({
    title: item.title,
    authors: item.authorString,
    journal: item.journalTitle,
    publicationDate: item.firstPublicationDate,
    doi: item.doi,
    pmid: item.pmid,
    pmcid: item.pmcid,
    abstract: item.abstractText,
    licenseLabel: item.license,
    sourceUrl: item.pmcid
      ? `https://europepmc.org/articles/${item.pmcid}`
      : item.doi
        ? `https://doi.org/${item.doi}`
        : null,
    sources: [SOURCES.europepmc]
  }));
}

// PubMed
async function searchPubMed(query, limit) {
  const searchUrl = new URL(
    "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi"
  );

  searchUrl.searchParams.set("db", "pubmed");
  searchUrl.searchParams.set("term", query);
  searchUrl.searchParams.set("retmode", "json");
  searchUrl.searchParams.set("retmax", String(limit));

  const searchData = await fetchJson(searchUrl.toString());
  const ids = searchData.esearchresult?.idlist || [];

  if (!ids.length) return [];

  const summaryUrl = new URL(
    "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi"
  );

  summaryUrl.searchParams.set("db", "pubmed");
  summaryUrl.searchParams.set("id", ids.join(","));
  summaryUrl.searchParams.set("retmode", "json");

  const summaryData = await fetchJson(summaryUrl.toString());

  return ids.map(id => {
    const item = summaryData.result?.[id];
    if (!item) return null;

    const doiEntry = item.articleids?.find(
      entry => entry.idtype === "doi"
    );

    return {
      title: item.title,
      authors: (item.authors || [])
        .map(author => author.name)
        .join(", "),
      journal: item.fulljournalname || item.source,
      publicationDate: item.pubdate,
      doi: doiEntry?.value,
      pmid: id,
      sourceUrl: `https://pubmed.ncbi.nlm.nih.gov/${id}/`,
      sources: [SOURCES.pubmed]
    };
  }).filter(Boolean);
}

// Crossref
async function searchCrossref(query, limit) {
  const url = new URL("https://api.crossref.org/works");

  url.searchParams.set("query", query);
  url.searchParams.set("rows", String(limit));
  url.searchParams.set("select",
    "DOI,title,author,container-title,published,URL,license");

  const data = await fetchJson(url.toString());

  return (data.message?.items || []).map(item => {
    const licenseEntry = (item.license || []).find(
      entry => entry.URL
    );

    return {
      title: item.title?.[0],
      authors: (item.author || [])
        .map(author =>
          [author.given, author.family].filter(Boolean).join(" ")
        )
        .join(", "),
      journal: item["container-title"]?.[0],
      publicationDate: item.published?.["date-parts"]?.[0]?.join("-"),
      doi: item.DOI,
      licenseUrl: licenseEntry?.URL,
      sourceUrl: item.URL,
      sources: [SOURCES.crossref]
    };
  });
}

// OpenAlex
async function searchOpenAlex(query, limit) {
  const url = new URL("https://api.openalex.org/works");

  url.searchParams.set("search", query);
  url.searchParams.set("per-page", String(limit));

  const data = await fetchJson(url.toString());

  return (data.results || []).map(item => {
    const location = item.best_oa_location || {};

    return {
      title: item.title,
      authors: (item.authorships || [])
        .map(author =>
          author.author?.display_name
        )
        .filter(Boolean)
        .join(", "),
      journal: location.source?.display_name,
      publicationDate: item.publication_date,
      doi: item.doi,
      licenseLabel: location.license,
      sourceUrl: item.doi || item.id,
      sources: [SOURCES.openalex]
    };
  });
}

router.get("/search", async (req, res) => {
  const query = clean(req.query.q);

  const requestedLimit = Number.parseInt(req.query.limit, 10);
  const limit = Number.isFinite(requestedLimit)
    ? Math.min(Math.max(requestedLimit, 1), 20)
    : 10;

  if (!query || query.length < 2 || query.length > 300) {
    return res.status(400).json({
      success: false,
      error: "عبارت جست‌وجو باید بین ۲ تا ۳۰۰ نویسه باشد."
    });
  }

  const tasks = [
    ["europepmc", () => searchEuropePMC(query, limit)],
    ["pubmed", () => searchPubMed(query, limit)],
    ["crossref", () => searchCrossref(query, limit)],
    ["openalex", () => searchOpenAlex(query, limit)]
  ];

  const settled = await Promise.allSettled(
    tasks.map(([, task]) => task())
  );

  const records = [];
  const sourceStatus = {};

  settled.forEach((result, index) => {
    const sourceKey = tasks[index][0];

    if (result.status === "fulfilled") {
      records.push(...result.value);
      sourceStatus[sourceKey] = {
        available: true,
        count: result.value.length
      };
    } else {
      sourceStatus[sourceKey] = {
        available: false,
        count: 0,
        error: "دریافت اطلاعات از این منبع ناموفق بود."
      };

      console.error(
        `PHARMANEX ${sourceKey} search error:`,
        result.reason?.message
      );
    }
  });

  const articles = mergeArticles(records);

  return res.json({
    success: true,
    query,
    total: articles.length,
    sources: sourceStatus,
    articles
  });
});

export default router;
