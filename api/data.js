const SHEET_CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vQe1qVYU1Phvbnjs3-X1lSNYCvmZFz78TqSj4VowqilN6p_FdvqLxYoUboU8JhXh8IlBBsaOkH2cF61/pub?gid=814918860&single=true&output=csv";

module.exports = async function handler(request, response) {
  try {
    const sheetResponse = await fetch(SHEET_CSV_URL, {
      headers: {
        "User-Agent": "DRE-Eduarda-Dashboard/1.0"
      }
    });

    if (!sheetResponse.ok) {
      throw new Error(`Google Sheets returned ${sheetResponse.status}`);
    }

    const csv = await sheetResponse.text();
    response.setHeader("Content-Type", "text/csv; charset=utf-8");
    response.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=3600");
    response.status(200).send(csv);
  } catch (error) {
    response.status(502).json({
      error: "Nao foi possivel carregar a planilha publicada.",
      detail: error.message
    });
  }
};
