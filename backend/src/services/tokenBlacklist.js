const blacklist = new Set();

function add(token) {
  blacklist.add(token);
}

function has(token) {
  return blacklist.has(token);
}

function clear() {
  blacklist.clear();
}

module.exports = { add, has, clear };
