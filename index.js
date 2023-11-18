
const express = require('express')
const cors = require('cors')
const app = express()
const port=process.env.PORT || 3000

// Malware configuration
app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.send(`Bistroboss server is running at ${port} port`)
})

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})