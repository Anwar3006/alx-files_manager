/* eslint-disable consistent-return */
const sha1 = require('sha1');
const { v4: uuid } = require('uuid');
const dbClient = require('../utils/db');
const redisClient = require('../utils/redis');

const getConnect = async (req, res) => {
  // get authorization header from headers
  const header = req.headers.authorization;
  const usersCollection = await dbClient.usersCollection();

  if (header) {
    // convert the weird characters back to the format 'email':'password'
    const Auth = new Buffer
      .From(header.split(' ')[1], 'base64')
      .toString().split(':');

    const user = Auth[0];
    const password = Auth[1];

    // check users collection if user is present
    const getUser = await usersCollection
      .findOne({ email: user, password: sha1(password) });

    if (!getUser) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    // console.log(getUser);
    const token = uuid();
    const key = `auth_${token}`;
    const value = getUser._id.toString();

    await redisClient.set(key, value, 86400);
    res.status(200).json({ token });
  }
};

const getDisconnect = async (req, res) => {
  const token = req.headers['x-token'];
  const key = `auth_${token}`;

  const userId = await redisClient.get(key);

  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  await redisClient.del(key);
  res.status(204);
};

module.exports = { getConnect, getDisconnect };
