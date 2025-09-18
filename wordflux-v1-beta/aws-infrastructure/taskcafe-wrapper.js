const http = require('http');

const TASKCAFE_URL = process.env.TASKCAFE_URL || 'http://52.4.68.118:3333';
const TASKCAFE_ENDPOINT = new URL(TASKCAFE_URL);
const TASKCAFE_DONE_COLUMN = process.env.TASKCAFE_DONE_COLUMN || '7a281af1-792e-4d6a-a999-2f6bf318b25c';
const TASKCAFE_REVIEW_COLUMN = process.env.TASKCAFE_REVIEW_COLUMN || 'cac31a9a-7b1a-4296-b44e-e02354b5ffd0';
const TASKCAFE_BACKLOG_COLUMN = process.env.TASKCAFE_BACKLOG_COLUMN || 'a17edba2-6d2c-4376-a87c-3572953ddd5e';

function requestOptions(extraHeaders = {}) {
  return {
    hostname: TASKCAFE_ENDPOINT.hostname,
    port: TASKCAFE_ENDPOINT.port || 3333,
    path: '/graphql',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...extraHeaders,
    },
  };
}

async function loginTaskCafe() {
  const payload = JSON.stringify({
    username: process.env.TASKCAFE_USERNAME || 'admin',
    password: process.env.TASKCAFE_PASSWORD || 'admin123',
  });

  const options = {
    ...requestOptions({ 'Content-Length': Buffer.byteLength(payload) }),
    path: '/auth/login',
  };

  return new Promise((resolve, reject) => {
    const req = http.request(options, res => {
      let body = '';
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => {
        const cookies = res.headers['set-cookie'];
        const authCookie = Array.isArray(cookies)
          ? cookies.find(cookie => cookie.startsWith('authToken='))
          : undefined;

        if (!authCookie) {
          return reject(new Error(`Failed to obtain TaskCafe auth cookie: ${body}`));
        }

        const token = authCookie.split(';')[0];
        resolve(token);
      });
    });

    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

async function runMutation(authCookie, { operation, cardId, reason }) {
  const targetColumn = operation === 'approve'
    ? TASKCAFE_DONE_COLUMN
    : TASKCAFE_BACKLOG_COLUMN;

  const payload = JSON.stringify({
    query: `mutation MoveTask($taskId: UUID!, $taskGroupId: UUID!, $position: Float!) {
      updateTaskLocation(input: {taskID: $taskId, taskGroupID: $taskGroupId, position: $position}) {
        task {
          id
          name
          taskGroup { id name }
        }
      }
    }`,
    variables: {
      taskId: cardId,
      taskGroupId: targetColumn,
      position: parseFloat(process.env.TASKCAFE_TARGET_POSITION || '65535')
    }
  });

  const options = requestOptions({
    'Content-Length': Buffer.byteLength(payload),
    'Cookie': authCookie
  });

  return new Promise((resolve, reject) => {
    const req = http.request(options, res => {
      let body = '';
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => {
        try {
          resolve({
            statusCode: res.statusCode,
            body: JSON.parse(body || '{}')
          });
        } catch (error) {
          reject(error);
        }
      });
    });

    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

exports.handler = async (event) => {
  console.log('Event:', JSON.stringify(event));

  try {
    const body = JSON.parse(event.body || '{}');
    const { operation, cardId } = body;

    if (!operation || !cardId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'operation and cardId are required' })
      };
    }

    if (!['approve', 'reject'].includes(operation)) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'operation must be approve or reject' })
      };
    }

    const token = await loginTaskCafe();
    const mutationResult = await runMutation(token, body);

    if (mutationResult.statusCode !== 200) {
      return {
        statusCode: mutationResult.statusCode,
        body: JSON.stringify({
          success: false,
          operation,
          cardId,
          error: mutationResult.body
        })
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        operation,
        cardId,
        result: mutationResult.body
      })
    };
  } catch (error) {
    console.error('Lambda error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};
