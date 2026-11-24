
/**
 * PHARMANEX
 * Scientific Quality Assessment Engine
 *
 * Version: 1.0.0
 *
 * Purpose:
 * Build a transparent evidence profile for scientific articles.
 * This module does not produce a definitive scientific quality score.
 */

const UNKNOWN = "unknown";
const NOT_FOUND = "not_found";

function normalizeText(value) {
  return typeof value === "string"
    ? value.trim()
    : "";
}

function normalizeDate(value) {
  if (!value) return null;

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString().slice(0, 10);
}

function createEvidenceItem(value, source = null) {
  return {
    value: value ?? null,
    status: value === null || value === undefined
      ? UNKNOWN
      : "available",
    source
  };
}

function classifyPublicationType(type = "") {
  const value = normalizeText(type).toLowerCase();

  const categories = [
    {
      patterns: ["systematic review", "meta-analysis"],
      category: "systematic_review"
    },
    {
      patterns: ["randomized controlled trial", "clinical trial"],
      category: "clinical_trial"
    },
    {
      patterns: ["observational", "cohort", "case-control"],
      category: "observational_study"
    },
    {
      patterns: ["case report", "case series"],
      category: "case_report_or_series"
    },
    {
      patterns: ["review"],
      category: "narrative_review"
    },
    {
      patterns: ["editorial", "comment"],
      category: "editorial_or_commentary"
    },
    {
      patterns: ["preprint"],
      category: "preprint"
    }
  ];

  for (const item of categories) {
    if (
      item.patterns.some(pattern =>
        value.includes(pattern)
      )
    ) {
      return item.category;
    }
  }

  return value ? "other_or_unclassified" : UNKNOWN;
}

function classifyPeerReview(status = "") {
  const value = normalizeText(status).toLowerCase();

  if (!value) return UNKNOWN;

  if (
    value.includes("preprint") ||
    value.includes("not peer reviewed")
  ) {
    return "not_peer_reviewed";
  }

  if (
    value.includes("peer reviewed") ||
    value.includes("peer-reviewed")
  ) {
    return "peer_reviewed";
  }

  return UNKNOWN;
}

function classifyRetraction(article = {}) {
  if (article.isRetracted === true) {
    return "retracted";
  }

  if (article.hasRetractionNotice === true) {
    return "retraction_notice_found";
  }

  if (article.hasCorrection === true) {
    return "correction_found";
  }

  if (
    article.isRetracted === false &&
    article.hasRetractionNotice === false
  ) {
    return "no_retraction_record_in_checked_sources";
  }

  return UNKNOWN;
}

function classifyFunding(article = {}) {
  if (article.fundingDeclared === true) {
    return "funding_declared";
  }

  if (article.fundingDeclared === false) {
    return "no_funding_statement_found";
  }

  return UNKNOWN;
}

function classifyConflicts(article = {}) {
  if (article.conflictOfInterestDeclared === true) {
    return "conflict_statement_declared";
  }

  if (article.conflictOfInterestDeclared === false) {
    return "no_conflict_statement_found";
  }

  return UNKNOWN;
}

function classifyIndexing(article = {}) {
  const databases = Array.isArray(article.indexedIn)
    ? article.indexedIn.filter(Boolean)
    : [];

  return {
    databases,
    status: databases.length
      ? "indexed_in_reported_databases"
      : UNKNOWN
  };
}

function classifyCitations(article = {}) {
  const count = Number(article.citationCount);
  const year = Number(article.publicationYear);

  if (!Number.isFinite(count) || count < 0) {
    return {
      count: null,
      citationsPerYear: null,
      status: UNKNOWN
    };
  }

  const currentYear = new Date().getUTCFullYear();

  const age = Number.isFinite(year) && year > 0
    ? Math.max(1, currentYear - year + 1)
    : null;

  return {
    count,
    citationsPerYear: age
      ? Number((count / age).toFixed(2))
      : null,
    status: age
      ? "available_age_adjusted"
      : "available_without_age_adjustment"
  };
}

export function assessArticle(article = {}) {
  const publicationDate = normalizeDate(
    article.publicationDate
  );

  const publicationYear = publicationDate
    ? Number(publicationDate.slice(0, 4))
    : Number(article.publicationYear) || null;

  const publicationType = classifyPublicationType(
    article.publicationType
  );

  const peerReview = classifyPeerReview(
    article.peerReviewStatus
  );

  const retractionStatus = classifyRetraction(article);

  const fundingStatus = classifyFunding(article);

  const conflictStatus = classifyConflicts(article);

  const indexing = classifyIndexing(article);

  const citations = classifyCitations({
    ...article,
    publicationYear
  });

  const warnings = [];

  if (publicationType === "preprint") {
    warnings.push(
      "این اثر پیش‌چاپ است و نباید مقاله داوری‌شده تلقی شود."
    );
  }

  if (peerReview === "not_peer_reviewed") {
    warnings.push(
      "وضعیت داوری نشان می‌دهد مقاله داوری همتا نشده است."
    );
  }

  if (retractionStatus === "retracted") {
    warnings.push(
      "این مقاله پس‌گرفته شده است؛ استفاده علمی از آن نیازمند احتیاط ویژه است."
    );
  }

  if (retractionStatus === UNKNOWN) {
    warnings.push(
      "وضعیت پس‌گرفتن مقاله هنوز از منابع بررسی‌شده تأیید نشده است."
    );
  }

  if (fundingStatus === UNKNOWN) {
    warnings.push(
      "اطلاعات تأمین مالی در داده‌های دریافتی مشخص نیست."
    );
  }

  if (conflictStatus === UNKNOWN) {
    warnings.push(
      "اطلاعات تعارض منافع در داده‌های دریافتی مشخص نیست."
    );
  }

  return {
    engine: "PHARMANEX Scientific Assessment",
    version: "1.0.0",

    article: {
      doi: normalizeText(article.doi) || null,
      pmid: normalizeText(article.pmid) || null,
      title: normalizeText(article.title) || null
    },

    evidenceProfile: {
      publicationType: createEvidenceItem(
        publicationType,
        article.publicationTypeSource
      ),

      peerReview: createEvidenceItem(
        peerReview,
        article.peerReviewSource
      ),

      publicationDate: createEvidenceItem(
        publicationDate,
        article.publicationDateSource
      ),

      retraction: createEvidenceItem(
        retractionStatus,
        article.retractionSource
      ),

      indexing: createEvidenceItem(
        indexing,
        article.indexingSource
      ),

      citations: createEvidenceItem(
        citations,
        article.citationSource
      ),

      funding: createEvidenceItem(
        fundingStatus,
        article.fundingSource
      ),

      conflictsOfInterest: createEvidenceItem(
        conflictStatus,
        article.conflictSource
      )
    },

    warnings,

    limitations: [
      "این پروفایل جایگزین ارزیابی تخصصی روش‌شناسی مطالعه نیست.",
      "نبود اطلاعات به معنی نبود مشکل یا تأیید اعتبار مقاله نیست.",
      "تعداد استناد به‌تنهایی معیار کیفیت علمی محسوب نمی‌شود.",
      "نمایه‌سازی مجله به‌تنهایی اعتبار تمام مقالات آن را تضمین نمی‌کند.",
      "نتایج باید همراه با منبع و تاریخ بررسی تفسیر شوند."
    ],

    overallAssessment: {
      status: "requires_human_review",
      score: null,
      explanation:
        "PHARMANEX در این نسخه امتیاز قطعی کیفیت علمی تولید نمی‌کند."
    }
  };
}

export { NOT_FOUND, UNKNOWN };
