
import express from "express";
import { checkArticleLicense } from "./license.js";
import { assessArticle } from "./scientific-assessment.js";

const router = express.Router();

const SOURCES = {
  europepmc: "Europe PMC",
  pubmed: "PubMed",
  crossref: "Crossref",
  openalex: "OpenAlex"
};

const clean = value =>
  typeof value === "string" ? value.trim() : "";

function normalizeDoi(value) {
  return clean(value)
    .toLowerCase()
    .replace(/^https?:\/\/(dx\.)?doi\.org\//, "")
    .replace(/^doi:\s*/, "");
}

function normalizeDate(value) {
  if (!value) return "";

  const text = String(value).trim();

  if (/^\d{4}(-\d{2})?(-\d{2})?$/.test(text)) {
    return text;
  }

  const date = new Date(text);
  return Number.isNaN(date.getTime())
    ? ""
    : date.toISOString().slice(0, 10);
}

function normalizeType(value) {
  if (Array.isArray(value)) {
    return value.map(item =>
      typeof item === "string"
        ? item
        : item?.name || item?.pubType || ""
    ).filter(Boolean).join("; ");
  }

  return clean(value);
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "PHARMANEX/2.1"
    },
    signal: AbortSignal.timeout(20000)
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return response.json();
}

function normalizeArticle(raw) {
  const licenseUrl = clean(raw.licenseUrl);
  const licenseLabel = clean(raw.licenseLabel);
  const licenseCheck = checkArticleLicense(licenseUrl);

  const article = {
    title: clean(raw.title) || "عنوان نامشخص",
    authors: clean(raw.authors),
    journal: clean(raw.journal),
    publicationDate: normalizeDate(raw.publicationDate),
    publicationType: normalizeType(raw.publicationType),
    doi: normalizeDoi(raw.doi),
    pmid: clean(raw.pmid),
    pmcid: clean(raw.pmcid),
    abstract: clean(raw.abstract),
    sourceUrl: clean(raw.sourceUrl),
    sources: [...new Set(raw.sources || [])],

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
    },

    assessmentData: {
      publicationType: normalizeType(raw.publicationType),
      peerReviewStatus: raw.peerReviewStatus || null,
      publicationYear: raw.publicationYear || null,
      citationCount: raw.citationCount ?? null,
      indexedIn: raw.indexedIn || [],
      isRetracted: raw.isRetracted,
      hasRetractionNotice: raw.hasRetractionNotice,
      hasCorrection: raw.hasCorrection,
      fundingDeclared: raw.fundingDeclared,
      conflictOfInterestDeclared:
        raw.conflictOfInterestDeclared,

      publicationTypeSource: raw.publicationTypeSource || null,
      peerReviewSource: raw.peerReviewSource || null,
      publicationDateSource: raw.publicationDateSource || null,
      retractionSource: raw.retractionSource || null,
      indexingSource: raw.indexingSource || null,
      citationSource: raw.citationSource || null,
      fundingSource: raw.fundingSource || null,
      conflictSource: raw.conflictSource || null
    }
  };

  article.scientificAssessment = assessArticle({
    title: article.title,
    doi: article.doi,
    pmid: article.pmid,
    publicationDate: article.publicationDate,
    ...article.assessmentData
  });

  return article;
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
    publicationDate: item.firstPublicationDate || item.pubYear,
    publicationType: item.pubTypeList?.pubType || [],
    doi: item.doi,
    pmid: item.pmid,
    pmcid: item.pmcid,
    abstract: item.abstractText,
    licenseLabel: item.license,
    citationCount: item.citedByCount,
    publicationTypeSource: SOURCES.europepmc,
    citationSource: SOURCES.europepmc,
    sourceUrl: item.pmcid
      ? `https://europepmc.org/articles/${item.pmcid}`
      : item.doi
        ? `https://doi.org/${item.doi}`
        : "",
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

    const doi = item.articleids?.find(
      entry => entry.idtype === "doi"
    );

    return {
      title: item.title,
      authors: (item.authors || [])
        .map(author => author.name)
        .join(", "),
      journal: item.fulljournalname || item.source,
      publicationDate: item.pubdate,
      publicationType: item.pubtype || [],
      doi: doi?.value,
      pmid: id,
      publicationTypeSource: SOURCES.pubmed,
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
  url.searchParams.set(
    "select",
    "DOI,title,author,container-title,published,URL,license,type,is-referenced-by-count"
  );

  const data = await fetchJson(url.toString());

  return (data.message?.items || []).map(item => {
    const license = (item.license || []).find(
      entry => entry.URL
    );

    return {
      title: item.title?.[0],
      authors: (item.author || [])
        .map(author =>
          [author.given, author.family]
            .filter(Boolean)
            .join(" ")
        )
        .join(", "),
      journal: item["container-title"]?.[0],
      publicationDate:
        item.published?.["date-parts"]?.[0]?.join("-"),
      publicationType: item.type,
      doi: item.DOI,
      licenseUrl: license?.URL,
      citationCount: item["is-referenced-by-count"],
      publicationTypeSource: SOURCES.crossref,
      citationSource: SOURCES.crossref,
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
        .map(author => author.author?.display_name)
        .filter(Boolean)
        .join(", "),
      journal: location.source?.display_name,
      publicationDate: item.publication_date,
      publicationType: item.type,
      doi: item.doi,
      licenseLabel: location.license,
      citationCount: item.cited_by_count,
      isRetracted: item.is_retracted === true,
      publicationTypeSource: SOURCES.openalex,
      citationSource: SOURCES.openalex,
      retractionSource: SOURCES.openalex,
      sourceUrl: item.doi || item.id,
      sources: [SOURCES.openalex]
    };
  });
}

// Merge duplicate articles
function mergeArticles(records) {
  const articles = new Map();

  for (const raw of records) {
    const article = normalizeArticle(raw);

    const key = article.doi
      ? `doi:${article.doi}`
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

    const fields = [
      "abstract",
      "authors",
      "journal",
      "publicationDate",
      "publicationType",
      "doi",
      "pmid",
      "pmcid",
      "sourceUrl"
    ];

    for (const field of fields) {
      if (!existing[field] && article[field]) {
        existing[field] = article[field];
      }
    }

    if (!existing.license.url && article.license.url) {
      existing.license = article.license;
    }

    for (const key of Object.keys(existing.assessmentData)) {
      const current = existing.assessmentData[key];
      const incoming = article.assessmentData[key];

      const empty =
        current === null ||
        current === undefined ||
        current === "" ||
        (Array.isArray(current) && current.length === 0);

      if (empty && incoming !== null && incoming !== undefined && incoming !== "") {
        existing.assessmentData[key] = incoming;
      }
    }
  }

  return [...articles.values()].map(article => {
    article.scientificAssessment = assessArticle({
      title: article.title,
      doi: article.doi,
      pmid: article.pmid,
      publicationDate: article.publicationDate,
      ...article.assessmentData
    });

    return article;
  });
}

// Search endpoint
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

  const results = await Promise.allSettled(
    tasks.map(([, task]) => task())
  );

  const records = [];
  const sourceStatus = {};

  results.forEach((result, index) => {
    const sourceKey = tasks[index][0];

    if (result.status === "fulfilled") {
      records.push(...result.value);

      sourceStatus[sourceKey] = {
        name: SOURCES[sourceKey],
        available: true,
        count: result.value.length
      };
    } else {
      sourceStatus[sourceKey] = {
        name: SOURCES[sourceKey],
        available: false,
        count: 0,
        error: "دریافت اطلاعات از این منبع ناموفق بود."
      };

      console.error(
        `PHARMANEX ${sourceKey} error:`,
        result.reason?.message
      );
    }
  });

  const articles = mergeArticles(records);

  return res.json({
    success: true,
    version: "2.1.0",
    query,
    total: articles.length,
    sources: sourceStatus,
    articles
  });
});

export default router;
