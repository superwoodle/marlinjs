const serial = require('./serial');
const device = new serial('COM7', 115200);

const express = require('express');
const app = express();
var bodyParser = require('body-parser');

app.use(bodyParser.json()); // support json encoded bodies
app.use(bodyParser.urlencoded({ extended: true })); // support encoded bodies

var multer = require('multer');
var upload = multer({ dest: 'uploads' });

app.get('/', (req, res) => res.send('Hello World!'));
app.post('/print', upload.single('file'), (req, res) => {
    console.log(req.file);
    device.printFile(req.file.path);
    res.send('Got it')
});

app.listen(3000, () => console.log('Example app listening on port 3000!'));