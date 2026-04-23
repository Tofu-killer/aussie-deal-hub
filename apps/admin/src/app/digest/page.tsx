import React from "react";

interface DigestLocalePreview {
  locale?: string;
  subject?: string;
  html?: string;
  deals?: DigestPreviewItem[];
}

interface DigestPreviewItem {
  id: string;
  merchant?: string;
  title?: string;
}

interface DigestPreview {
  en?: DigestLocalePreview;
  zh?: DigestLocalePreview;
}

interface DigestPreviewResult {
  digest: DigestPreview | null;
  error: string | null;
}

async function loadDigestPreview(): Promise<DigestPreviewResult> {
  const apiBaseUrl = process.env.ADMIN_API_BASE_URL ?? "http://127.0.0.1:3001";

  try {
    const response = await fetch(`${apiBaseUrl}/v1/admin/digest-preview`, {
      cache: "no-store",
    });

    if (!response.ok) {
      return {
        digest: null,
        error: "Failed to load digest preview.",
      };
    }

    const body = (await response.json()) as DigestPreview;

    return {
      digest: body.en || body.zh ? body : null,
      error: body.en || body.zh ? null : "Failed to load digest preview.",
    };
  } catch {
    return {
      digest: null,
      error: "Failed to load digest preview.",
    };
  }
}

export default async function DigestPage() {
  const { digest, error } = await loadDigestPreview();
  const englishDigest = digest?.en;
  const chineseDigest = digest?.zh;

  return (
    <main>
      <h1>Digest preview</h1>
      <p>Preview the next localized digest before publishing it to subscribers.</p>

      {error ? (
        <p>{error}</p>
      ) : !digest ? (
        <p>No digest preview available.</p>
      ) : (
        <section>
          <h2>English digest</h2>
          <p>{englishDigest?.subject ?? "No English subject returned."}</p>
          {englishDigest?.html ? (
            <div dangerouslySetInnerHTML={{ __html: englishDigest.html }} />
          ) : (
            <p>No English HTML returned.</p>
          )}
          <h3>English deals</h3>
          {englishDigest?.deals && englishDigest.deals.length > 0 ? (
            <table>
              <thead>
                <tr>
                  <th>Merchant</th>
                  <th>Title</th>
                </tr>
              </thead>
              <tbody>
                {englishDigest.deals.map((deal) => (
                  <tr key={deal.id}>
                    <td>{deal.merchant ?? "Unknown"}</td>
                    <td>{deal.title ?? "Untitled"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p>No English deals returned.</p>
          )}

          <h2>Chinese digest</h2>
          <p>{chineseDigest?.subject ?? "No Chinese subject returned."}</p>
          {chineseDigest?.html ? (
            <div dangerouslySetInnerHTML={{ __html: chineseDigest.html }} />
          ) : (
            <p>No Chinese HTML returned.</p>
          )}
          <h3>Chinese deals</h3>
          {chineseDigest?.deals && chineseDigest.deals.length > 0 ? (
            <table>
              <thead>
                <tr>
                  <th>Merchant</th>
                  <th>Title</th>
                </tr>
              </thead>
              <tbody>
                {chineseDigest.deals.map((deal) => (
                  <tr key={deal.id}>
                    <td>{deal.merchant ?? "Unknown"}</td>
                    <td>{deal.title ?? "Untitled"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p>No Chinese deals returned.</p>
          )}
        </section>
      )}
    </main>
  );
}
