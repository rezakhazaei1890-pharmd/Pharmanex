
import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import articlesRouter from "../articles/router.js";

test("PHARMANEX scientific article search API", async () => {
  const app = express();

  app.use("/api/articles", articlesRouter);

  const server = await new Promise((resolve, reject) => {
    const instance = app.listen(0, "127.0.0.1", () => {
      resolve(instance);
    });

    instance.on("error", reject);
  });

  const address = server.address();
  const endpoint = `http://127.0.0.1:${address.port}/api/articles/search?q=aspirin&limit=5`;

  try {
    const response = await fetch(endpoint, {
      signal: AbortSignal.timeout(60000)
    });

    assert.equal(
      response.status,
      200,
      "Article search API must return HTTP 200"
    );

    const data = await response.json();

    assert.ok(
      data && typeof data === "object",
      "API response must be a JSON object"
    );

    assert.ok(
      Array.isArray(data.articles),
      "API response must contain an articles array"
    );

    assert.ok(
      data.articles.length > 0,
      "Real scientific search should return at least one article"
    );

    for (const article of data.articles) {
      assert.ok(
        typeof article.title === "string" && article.title.length > 0,
        "Every article must have a title"
      );

      assert.ok(
        Array.isArray(article.sources) && article.sources.length > 0,
        "Every article must identify its source"
      );

      assert.ok(
        article.scientificAssessment &&
        typeof article.scientificAssessment === "object",
        "Every article must include a scientific assessment"
      );
    }

    console.log("PHARMANEX article search test passed.");
    console.log(`Articles returned: ${data.articles.length}`);
  } finally {
    await new Promise((resolve, reject) => {
      server.close(error => {
        if (error) reject(error);
        else resolve();
      });
    });
  }
});
