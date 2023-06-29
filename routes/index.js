const express = require('express')
const router = express.Router()

const { getStatus, getStats } = require('../controllers/AppController')
const { postNew, getMe } = require('../controllers/UsersController')
const { getConnect, getDisconnect } = require('../controllers/AuthController')
const { postUpload, getShow, getIndex, putPublish, putUnpublish, getFile } = require('../controllers/FilesController')


// GET Routes
router.route('/status').get(getStatus)
router.route('/stats').get(getStats)
router.route('/connect').get(getConnect)
router.route('/disconnect').get(getDisconnect)
router.route('/users/me').get(getMe)
router.route('/files/:id').get(getShow)
router.route('/files').get(getIndex)
router.route('/files/:id/data').get(getFile)

// POST Routes
router.route('/users').post(postNew)
router.route('/files').post(postUpload)

// PUT Routes
router.route('/files/:id/publish').put(putPublish)
router.route('/files/:id/unpublish').put(putUnpublish)

module.exports = router