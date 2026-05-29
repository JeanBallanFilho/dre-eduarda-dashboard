const SHEETS = {
  actual2026: "814918860",
  actual2025: "998510839",
  budget2026: "1577072601"
};

const BASE_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vQe1qVYU1Phvbnjs3-X1lSNYCvmZFz78TqSj4VowqilN6p_FdvqLxYoUboU8JhXh8IlBBsaOkH2cF61/pub";

module.exports = async function handler(request, response) {
  const name = request.query?.name;
  const gid = SHEETS[name];

  if (!gid) {
    response.status(400).json({ error: "Aba invalida." });
    return;
  }

  try {
    const url = `${BASE_URL}?gid=${gid}&single=true&output=csv&t=${Date.now()}`;
    const sheetResponse = await fetch(url, {
      headers: { "User-Agent": "DRE-Altar-Dashboard/1.0" }
    });

    if (!sheetResponse.ok) {
      throw new Error(`Google Sheets retornou ${sheetResponse.status}`);
    }

    const csv = await sheetResponse.text();
    response.setHeader("Content-Type", "text/csv; charset=utf-8");
    response.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    response.setHeader("Pragma", "no-cache");
    response.setHeader("Expires", "0");
    response.status(200).send(csv);
  } catch (error) {
    response.status(502).json({
      error: "Nao foi possivel carregar a aba publicada.",
      detail: error.message
    });
  }
};
