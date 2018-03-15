const Koa = require('koa');
const Router = require('koa-router');
const logger = require('koa-logger');
const session = require('koa-session');
const bodyParser = require('koa-bodyparser');
const serve = require('koa-static');
const mount = require('koa-mount');
const views = require('koa-views');
const log4js = require('koa-log4');

const fs = require('fs');
const path = require('path');
const axios = require('axios');

const zf = require('./common/zf');
const infoLogger = require('./common/logger');

const app = new Koa();
const router = new Router();

app.keys = ['This is a secret by ISCNU'];

// logger
// app.use(logger());
app.use(log4js.koaLogger(log4js.getLogger("http"), { level: 'auto' }))


// parse request body
app.use(bodyParser());

// session
app.use(session({
  key: 'koa:sess',
  maxAge: 900000,
  overwrite: true,
  httpOnly: true,
  signed: true,
  rolling: false,
  renew: true,
}, app));

// static files
app.use(mount('/static', serve('./static')));

// ics files
app.use(mount('/webcal', serve('./data/ics')));

// 加载模板引擎
app.use(views(path.join(__dirname, './views'), {
  extension: 'ejs'
}));

// 验证登录状态中间件
async function requireLogin(ctx, next) {
  if (!ctx.session.student_id) {
    ctx.type = 'json';
    ctx.body = {
      success: false,
      msg: '您没有登录'
    }
  } else {
    await next(ctx, next);
  }
}

// 验证码
router.get('/api/captcha', async function (ctx) {
  try {
    let { data, cookie, hidden } = await zf.getCaptcha();
    ctx.session.student_id = '';
    ctx.session.name = '';
    ctx.session.cookie = cookie;
    ctx.session.hidden = hidden;
    ctx.type = 'image/gif';
    ctx.body = data;
  } catch (e) {
    console.log(e);
    ctx.throw(500);
  }
});

// 登录系统
router.post('/api/login', async function (ctx) {
  ctx.type = 'json';
  const { username, password, code } = ctx.request.body || {};
  // check input data
  try {
    if (!username || !password || !code) throw '填写信息不完整，请重试';
    if (!/^\d{11}$/.test(username)) throw '用户名不合规则';
    if (!/^[a-z0-9A-Z]{4}$/.test(code)) throw '验证码不合规则';
    if (!ctx.session.cookie) throw '验证码错误';
  } catch (e) {
    console.log(e);
    ctx.body = {
      success: false,
      msg: e,
    };
    return;
  }
  try {
    infoLogger.info(`User login, id: ${username}`);
    let { error, student_id, name } = await zf.jwcLogin(ctx.session.cookie, ctx.session.hidden, username, password, code);
    infoLogger.info(`User login success, id: ${username}`);
    if (error) {
      ctx.body = {
        success: false,
        msg: error,
      };
    } else {
      ctx.session.student_id = student_id;
      ctx.session.name = name;
      ctx.body = {
        success: true,
        msg: 'ok',
        student_id,
        name,
      }
    }
  } catch (e) {
    console.log(e);    
    return Promise.reject(e);
  }
});

// 生成ICS
router.post('/api/generate_ics', requireLogin, async function (ctx) {
  ctx.type = 'json';
  const { alarm, teacher } = ctx.request.body || {};
  try {
    let courseList = await zf.getSchedule(ctx.session.cookie, ctx.session.student_id);
    // console.log('list', courseList);
    let filename = await zf.generateICS(courseList, alarm, teacher);
    // console.log('filename', filename);
    infoLogger.info(`ics file generated, id: ${ctx.session.student_id}, filename: ${filename}, alarm: ${alarm}, teacher: ${teacher}`);

    ctx.body = {
      success: true,
      filename
    }
  } catch (e) {
    console.log(e);
    ctx.body = {
      success: false,
      msg: '服务器内部出错'
    }
  }
});

// 获取课表
router.post('/api/schedule', requireLogin, async function (ctx) {
  ctx.type = 'json';
  try {
    let courseList = await zf.getSchedule(ctx.session.cookie, ctx.session.student_id);
    ctx.body = {
      success: true,
      courseList
    }
  } catch (e) {
    console.log(e);
    ctx.body = {
      success: false,
      msg: '服务器内部出错'
    }
  }
});

router.get('/', async function (ctx) {
  ctx.type = 'html';
  await ctx.render('index', {
    title: 'iCal课表导出工具 - ISCNU',
    page: 'index',
  });
});

router.get('/generate', async function (ctx) {
  ctx.type = 'html';
  await ctx.render('generate', {
    title: 'iCal课表导出工具 - ISCNU',
    page: 'generate',
  });
});

router.get('/doc', async function (ctx) {
  ctx.type = 'html';
  await ctx.render('doc', {
    title: '使用指引 - iCal课表导出工具 - ISCNU',
    page: 'doc',
  });
});

app.use(router.routes());
app.use(router.allowedMethods());


/**
 * Get port from environment.
 */

let port = normalizePort(process.env.PORT || '3000');
app.listen(port);
console.info('Listening on ' + port);


/**
 * Normalize a port into a number, string, or false.
 */

function normalizePort(val) {
  var port = parseInt(val, 10);

  if (isNaN(port)) {
    // named pipe
    return val;
  }

  if (port >= 0) {
    // port number
    return port;
  }

  return false;
}
