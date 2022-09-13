import crypto = require("crypto");
/**
 * Function to validate if the request comes from slack
 * @param {string} signingSecret Slack signing secret
 * @param {string} timestamp  Request timestamp obtained throgh X-Slack-Request-Timestamp header
 * @param {string} payload Request raw body
 * @param {string} receivedSignature Request signature obtained throgh X-Slack-Signature header
 * @return {boolean} Returns result of signature validation
 */
export const isSignatureValid = (
    signingSecret: string,
    timestamp: string,
    payload: string,
    receivedSignature: string
): boolean => {
  const signatureString = `v0:${timestamp}:${payload}`;
  const hmac = crypto.createHmac("sha256", signingSecret);
  const signature = `v0=${hmac.update(signatureString).digest("hex")}`;

  return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(receivedSignature)
  );
};
