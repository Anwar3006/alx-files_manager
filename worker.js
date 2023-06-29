const Queue = require('bull')
const dbClient = require('./utils/db')
const fileQueue = new Queue('fileQueue')
const folderPath = process.env.FOLDER_PATH || './tmp/files_manager'
const fs = require('fs')
const thumbnail = require('image-thumbnail');


fileQueue.process(async (job) => {
  // Extract the necessary data from the job
  const { fileId, userId } = job.data;

  // Check if fileId is present in the job
  if (!fileId) {
    throw new Error('Missing fileId');
  }

  // Check if userId is present in the job
  if (!userId) {
    throw new Error('Missing userId');
  }

  // Query the database to find the document based on fileId and userId
  const filesCollection = await dbClient.filesCollection()
  const getFile = await filesCollection.findOne({ '_id': fileId, 'userId': userId })
  if (!getFile) {
    throw new Error('File not found')
  }

  const widths = [500, 250, 100];
  
  for (const width of widths) {
    try {
      const thumbnailOptions = { width };
      const thumbnailBuffer = await thumbnail(folderPath, thumbnailOptions);
      const thumbnailPath = `${folderPath}_${width}`

      fs.writeFileSync(thumbnailPath, thumbnailBuffer)
    } catch (error) {
        throw new Error('File writing failed')
    }
  }
})