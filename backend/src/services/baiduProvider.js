async function searchBaike(query) {
  // TODO: Integrate Baidu Baike search and normalize results into the local place schema.
  return [];
}

async function searchImages(query) {
  // TODO: Integrate image search. Each image must keep url, caption, and source fields.
  return [];
}

function normalizeBaikeResult(result) {
  // TODO: Convert Baidu Baike result fields into trusted place facts.
  return result;
}

module.exports = {
  normalizeBaikeResult,
  searchBaike,
  searchImages
};
