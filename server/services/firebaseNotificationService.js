// backend/services/firebaseNotificationService.js
const admin = require('firebase-admin');
const serviceAccount = require('../config/firebase-service-account.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}




async function sendToAllUsers(title, body, data = {}, tokens = []) {
  if (!tokens.length) {
    throw new Error('No FCM tokens found');
  }

  const message = {
    notification: {
      title,
      body,
    },
    data,
    tokens,
  };

  return await admin.messaging().sendEachForMulticast(message);
}


module.exports = {
  sendToAllUsers,admin
};





 
