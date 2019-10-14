const express= require('express')
const bodyParser = require('body-parser')
const cors = require('cors')
const fs = require('fs')
const path = require('path')
const app = express()

app.use(cors({ origin: '*' }))
app.use(express.static('public'))
app.use(bodyParser.urlencoded({extended: false}))
app.use(bodyParser.json())

let uploads = {};

app.get('/', (req, res) => {
    res.sendFile('/index.html')
})

app.get('/status', (req, res) => {
    let fileId = req.headers['x-file-id']
    let name = req.headers['name']
    let fileSize = parseInt(req.headers['size'], 10)

    if (name) {
        try {
            if (fs.existsSync('name/' + name)) {
                let stats = fs.statSync('name/' + name)
                console.log(`Incoming file size is ${fileSize} and ${Math.floor(stats.size / fileSize * 100)}% is already uploaded` )
                if (fileSize === stats.size) {
                    console.log('file present')
                    res.send({'fileState': 'present'})
                    return
                }
                uploads[fileId]['bytesReceived'] = stats.size
                console.log('bytes receive', stats.size)

            } else {
                console.log('file not present')
                uploads[fileId] = {}
                uploads[fileId]['bytesReceived'] = 0
            }
            
        } catch (e) {
            console.log('error', e)
        }

        let upload = uploads[fileId]
        if (upload) {
            res.send({ "uploaded": upload.bytesReceived})
        } else {
            res.send({ "uploaded": 0 })
        }
    }

})

app.post('/upload', (req, res, next) => {
    console.log(req)
    let fileId = req.headers['x-file-id']
    let startByte = req.headers['x-start-byte']
    let name = req.headers['name']
    let fileSize = parseInt(req.headers['size'], 10)

    console.log('upload requested', 'fileid', fileId, 'startByte', startByte, 'name', name, 'fileSize', fileSize)

    if(uploads[fileId] && fileSize === uploads[fileId].bytesReceived) {
        console.log('status: complete')
        res.send({'status': 'complete'})
        return
    }

    if (!fileId) {
        console.log('no such file')
        res.send('No such file')
        return
    }

    if (!uploads[fileId]) {
        uploads[fileId] = {}
    }

    let upload = uploads[fileId]

    let fileStream;

    if (startByte === '0') {
        console.log('new upload')
        upload.bytesReceived = 0;
        fileStream = fs.createWriteStream(`./name/${name}`, { flags: 'w' })

    } else {
        console.log('resuming upload')
        if (upload.bytesRecieved != startByte) {
            return res.end('Wrong start byte')
        }
        fileStream = fs.createWriteStreamI(`./name/${name}`, { flags: 'a' })
    }

    req.pipe(fileStream)

    req.on('data', data => {
        console.log('data')
        upload.bytesReceived += data.length
    })

    fileStream.on('close', () => {
        console.log(upload.bytesReceived, fileSize)
        if (upload.bytesReceived === fileSize) {
            console.log('upload finished')
            delete uploads[fileId]
            res.send({'status': 'uploaded'})
            return;
        } else {
            console.log('File unfinished, stopped at ' + upload.bytesReceived)
            return res.end('server error')
        }
    })

    fileStream.on('error', err => {
        console.log('filestream error', err)
        return res.end('filestream error')
    })
})

app.listen(3000, () => {
    console.log('Server running...')
})