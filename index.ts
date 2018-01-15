import * as express from 'express';
import * as bodyParser from 'body-parser';
import * as http from 'http';
import { random } from 'lodash';

const { createClient } = require('tumblr.js');

const {
  SLACK_TOKEN,
  TUMBLR_KEY,
  HEROKU_APP_NAME,
} = process.env;

const tumblr = createClient();

const app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

let numPosts: number = 0;

async function updateNumPosts() {
  tumblr.blogInfo('sweartrek.tumblr.com', { api_key: TUMBLR_KEY }, (err: any, resp: any) => {
    if (err) {
      console.error(err.stack);
      return;
    }

    numPosts = resp.blog.posts;
    console.log('total posts:', numPosts);
  });
}

if (HEROKU_APP_NAME) {
  setInterval(() => {
    http.get(`http://${HEROKU_APP_NAME}.herokuapp.com/`)
  }, 300000);
}

app.get('/', (req, res, next) => {
  console.log('saw ping');
  res.send('ok');
});

app.post('/slack', (req, res, next) => {
  if (!req.body.token || req.body.token !== SLACK_TOKEN) {
    res.status(500);
    res.send({ error: 'unable to verify slack token' });
    return;
  }

  const opts = {
    api_key: TUMBLR_KEY,
    limit: 1,
    type: 'photo',
    offset: numPosts - 1,
  };

  tumblr.blogPosts('sweartrek.tumblr.com', opts, (err: any, resp: any) => {
    if (err) {
      res.status(500);
      res.send({ text: 'error accessing tumblr api' });
      console.error(err.stack);
      return;
    }

    if (resp.blog && resp.blog.posts) {
      numPosts = resp.blog.posts;
    }

    const post = resp.posts[0];
    res.send({
      response_type: 'in_channel',
      attachments: [
        {
          text: post.summary,
          image_url: post.photos[0].original_size.url,
        },
      ],
    });
  });

});

updateNumPosts();

const server = app.listen(3000, () => {
  console.log('express server listening on port %d', server.address().port);
});
