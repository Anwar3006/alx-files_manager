/* eslint-disable consistent-return */
const Queue = require('bull');
const mime = require('mime-types');
const { v4: uuid } = require('uuid');
const ObjectId = require('mongodb').ObjectID;
const fs = require('fs');
const dbClient = require('../utils/db');
const redisClient = require('../utils/redis');

const folderPath = process.env.FOLDER_PATH || './tmp/files_manager';

const postUpload = async (req, res) => {
  const usersCollection = await dbClient.usersCollection();
  const filesCollection = await dbClient.filesCollection();
  const token = req.headers['x-token'];
  const key = `auth_${token}`;
  const fileQueue = new Queue('fileQueue');

  const objId = new ObjectId(await redisClient.get(key));
  const getUser = await usersCollection.findOne({ _id: objId });
  if (!getUser) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const {
    name, type, parentId, isPublic, data,
  } = req.body;
  const allowedTypes = ['file', 'folder', 'image'];
  if (name === undefined) return res.status(400).json({ error: 'Missing name' });
  if (!type || !allowedTypes.includes(type)) return res.status(400).json({ error: 'Missing type' });
  if (!data && type !== 'folder') return res.status(400).json({ error: 'Missing data' });
  if (parentId) {
    const getFile = await filesCollection.findOne({ parentId });
    if (!getFile) {
      return res.status(400).json({ error: 'Parent not found' });
    }
    if (getFile.type !== 'folder') {
      return res.status(400).json({ error: 'Parent is not a folder' });
    }
  }

  // if type === folder; put info into DB
  if (type === 'folder') {
    await filesCollection.insertOne({
      userId: getUser._id,
      name,
      type,
      isPublic: isPublic === 'true',
      parentId: parentId || 0,
    });
    const returned = await filesCollection.findOne(
      { userId: getUser._id, name }, { localPath: 0 },
    );
    return res.status(201).send(returned);
  }

  const fileName = uuid();
  const Utf8Data = new Buffer.From(data, 'base64').toString('utf-8');
  const localPath = `${folderPath}/${fileName}`;
  // create local directory
  if (fs.existsSync(folderPath)) {
    fs.writeFileSync(localPath, Utf8Data);
  } else {
    try {
      fs.mkdirSync(folderPath, { recursive: true }, (error) => {
        if (error) console.error(error);
      });
    } catch (error) {
      console.error(error);
    }
    fs.writeFileSync(localPath, Utf8Data);
  }

  let returned = {};
  if (type === 'file' || type === 'image') {
    await filesCollection.insertOne({
      userId: getUser._id,
      name,
      type,
      isPublic: isPublic === 'true',
      parentId: parentId || 0,
      localPath,
    });

    returned = await filesCollection.findOne(
      { userId: getUser._id, name }, { localPath: 0 },
    );
    return res.status(201).json({
      id: returned._id,
      userId: returned.userId,
      name: returned.name,
      type: returned.type,
      isPublic: returned.isPublic,
      parentId: returned.parentId,
    });
  }

  if (type === 'image') {
    const job = fileQueue.add({ fileId: returned._id, userId: returned.userId });
  }
};

const getShow = async (req, res) => {
  const token = req.headers['x-token'];
  const fileId = req.params;
  const key = `auth_${token}`;
  const filesCollection = await dbClient.filesCollection();

  const getUserId = await redisClient.get(key);
  if (!getUserId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const oId = new ObjectId(fileId.id);
  const getUserFromDB = await filesCollection.findOne({ _id: oId });
  if (!getUserFromDB) {
    return res.status(404).json({ error: 'Not found' });
  }
  res.status(201).json({
    id: fileId.id,
    userId: getUserFromDB.userId,
    name: getUserFromDB.name,
    type: getUserFromDB.type,
    isPublic: getUserFromDB.isPublic,
    parentId: getUserFromDB.parentId,
  });
};

const getIndex = async (req, res) => {
  const token = req.headers['x-token'];
  const key = `auth_${token}`;
  const parentId = req.query.parentId || '0';
  const page = req.query.page || '0';
  const filesCollection = await dbClient.filesCollection();

  const getUserId = await redisClient.get(key);
  if (!getUserId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const filesFilter = {
    userId: new ObjectId(getUserId),
    parentId: parseInt(parentId),
  };
  const pageSize = 20;
  const skip = page === '0' ? parseInt(page) : parseInt(page) * pageSize;

  const pagination = await filesCollection.aggregate([
    { $match: filesFilter },
    { $skip: skip },
    { $limit: pageSize },
    {
      $project: {
        _id: 0,
        id: '$_id',
        userId: '$userId',
        name: '$name',
        type: '$type',
        isPublic: '$isPublic',
        parentId: {
          $cond: { if: { $eq: ['$parentId', undefined] }, then: 0, else: '$parentId' },
        },
      },
    },
  ]).toArray();
  res.status(200).send(pagination);
};

const putPublish = async (req, res) => {
  const fileId = req.params.id;
  const key = `auth_${req.headers['x-token']}`;
  const filesCollection = await dbClient.filesCollection();
  const usersCollection = await dbClient.usersCollection();

  const objId = new ObjectId(await redisClient.get(key));
  const getUser = await usersCollection.findOne({ _id: objId });
  if (!getUser) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const getFile = await filesCollection.findOne({ _id: new ObjectId(fileId) });
  if (!getFile) {
    return res.status(404).json({ error: 'Not found' });
  }

  await filesCollection.updateOne(
    { _id: new ObjectId(fileId) },
    { $set: { isPublic: 'true' } },
  );
  const updated = await filesCollection.findOne({ _id: new ObjectId(fileId) });
  res.status(200).send(updated);
};

const putUnpublish = async (req, res) => {
  const tokenKey = `auth_${req.headers['x-token']}`;
  const fileId = req.params.id;
  const usersCollection = await dbClient.usersCollection();
  const filesCollection = await dbClient.filesCollection();

  const getUserFromRedis = await redisClient.get(tokenKey);
  const objId = new ObjectId(getUserFromRedis);
  const user = await usersCollection.findOne({ _id: objId });
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const file = await filesCollection.findOne({ _id: new ObjectId(fileId) });
  if (!file) {
    return res.status(404).json({ error: 'Not found' });
  }

  await filesCollection.updateOne(
    { _id: new ObjectId(fileId) },
    { $set: { isPublic: false } },
  );
  const updated = await filesCollection.findOne({ _id: new ObjectId(fileId) });
  res.status(200).send(updated);
};

const getFile = async (req, res) => {
  const tokenKey = `auth_${req.headers['x-token']}`;
  const fileId = req.params.id;
  const size = req.params.size || null;
  const filesCollection = await dbClient.filesCollection();

  const file = await filesCollection.findOne({ _id: new ObjectId(fileId) });
  if (!file) {
    return res.status(404).json({ error: 'Not found' });
  }

  const userIdFromRedis = await redisClient.get(tokenKey);

  if (file.isPublic === false && !userIdFromRedis) {
    return res.status(404).json({ error: 'Not found' });
  }

  if (file.type === 'folder') {
    return res.status(400).json({ error: 'A folder doesn\'t have content' });
  }

  if (!file.localPath || file.localPath.search('/tmp/files_manager') === -1) {
    return res.status(404).json({ error: 'Not found' });
  }

  const mimeType1 = mime.lookup(file.name);
  fs.readFile(file.localPath, (err, data) => {
    if (err) {
      return res.status(404).json({ error: 'Not found' });
    }
    res.status(200).set('Content-Type', mimeType1).send(data);
  });

  let filePath = file.localPath;
  if (size) {
    filePath = `${file.localPath}_${size}`;
  }
  if (fs.existsSync()) {
    const fileInfo = await fs.statAsync(filePath);
    if (!fileInfo.isFile()) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
  } else {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  const mimeType2 = mime.lookup(file.name);
  const absoluteFilePath = await fs.realpathAsync(filePath);
  res.status(200).set('Content-Type', mimeType2).sendFile(absoluteFilePath);
};

module.exports = {
  postUpload,
  getShow,
  getIndex,
  putPublish,
  putUnpublish,
  getFile,
};
