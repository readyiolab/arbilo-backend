const axios = require('axios');
const delay = require('./delay');

const fetchWithRetry = async (url, options, retries = 3) => {
  for (let i = 0; i < retries; i++) {
    try {
      return await axios.get(url, options);
    } catch (error) {
      if (i === retries - 1) throw error;
      await delay(1000);
    }
  }
};

module.exports = fetchWithRetry;
