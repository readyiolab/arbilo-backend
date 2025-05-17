const { S3Client } = require("@aws-sdk/client-s3");
const { doSpaceEndPoint, doSpaceRegion, doSpacesKey, doSpacesSecret } = require('./dotenvConfig');
const spacesClient = new S3Client({
  endpoint: doSpaceEndPoint, 
  region: doSpaceRegion,
  credentials: {
    accessKeyId: doSpacesKey,
    secretAccessKey: doSpacesSecret,
  },
});

module.exports = spacesClient;