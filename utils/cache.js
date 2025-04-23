const cache = {};

const isCacheValid = (timestamp, expiration = 5 * 60 * 1000) => {
  return Date.now() - timestamp < expiration;
};

module.exports = { cache, isCacheValid };
