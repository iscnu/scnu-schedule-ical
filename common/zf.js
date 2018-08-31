const axios = require('axios');
const iconv = require('iconv-lite');
const cheerio = require('cheerio');
const urlencode = require('urlencode');
const querystring = require('querystring');
const ical = require('ical-generator');
const md5 = require("blueimp-md5")

const schedule = require('./schedule');

// 获取验证码
exports.getCaptcha = async function () {
  // 1. 获取隐藏域
  let { headers, data } = await axios.get('https://jwc.scnu.edu.cn/', {
    responseType: 'arraybuffer',
    'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 8_4 like Mac OS X) AppleWebKit/600.1.4 (KHTML, like Gecko) Mobile/12H143'
  });

  // console.log(1, headers);
  let cookie = {};
  if (headers['set-cookie']) {
    headers['set-cookie'].forEach(function (v) {
      let kv = v.split(';')[0].split('=');
      cookie[kv[0]] = kv[1];
    })
  }

  let cookieStr = '';
  for (let v in cookie) {
    if (cookie.hasOwnProperty(v)) {
      cookieStr += `${v}=${cookie[v]}; `;
    }
  }

  let html = iconv.decode(data, 'gb2312');
  let $ = cheerio.load(html, { decodeEntities: false });
  let hidden = {};
  $("#form1 > input[type='hidden']").each(function (i, el) {
    hidden[$(el).attr('name')] = $(el).attr('value');
  });

  // console.log(cookieStr);
  // console.log(hidden);

  // 2. 获取验证码
  try {
    let response = await axios.get('https://jwc.scnu.edu.cn/CheckCode.aspx', {
      responseType: 'arraybuffer',
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 8_4 like Mac OS X) AppleWebKit/600.1.4 (KHTML, like Gecko) Mobile/12H143',
        'Referer': 'https://jwc.scnu.edu.cn/',
        'Cookie': cookieStr,
      }
    });
    let { status, headers, data } = response;
    if (status !== 200 || headers['content-type'].indexOf('image') === -1) throw "error";
    return {
      data,
      cookie: cookieStr,
      hidden
    };
  } catch (e) {
    return Promise.reject(e);
  }
}

// 登录网站
exports.jwcLogin = async function (cookie, hidden, username, password, code) {
  // console.log(cookie, hidden, username, password, code);
  try {
    // 登录
    let response = await axios.post('https://jwc.scnu.edu.cn/default2.aspx', querystring.stringify({
      ...hidden,
      txtUserName: username,
      TextBox2: password,
      txtSecretCode: code,
      Button1: '',
      lbLanguage: '',
      hidPdrs: '',
      hidsc: '',
    }) + "&RadioButtonList1=%D1%A7%C9%FA", {
      responseType: 'arraybuffer',
      headers: {
        'Cookie': cookie,
        'content-type': 'application/x-www-form-urlencoded',
        'Referer': 'https://jwc.scnu.edu.cn/',
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 8_4 like Mac OS X) AppleWebKit/600.1.4 (KHTML, like Gecko) Mobile/12H143',
      },
    });
    html = iconv.decode(response.data, 'gb2312');

    let error, student_id, name;
    let match = html.match(/xsgrxx\.aspx\?xh=(\d*?)&xm=(.*?)&gnmkdm/);
    if (match) {
      student_id = match[1];
      name = match[2];
    } else {
      error = '其它错误';
    }

    const errors = [
      "alert('验证码不正确！！')",
      "alert('用户名不存在或未按照要求参加教学活动！！')",
      "alert('密码错误，如忘记密码，请与教务处联系!')",
    ];

    for (var i = 0; i < errors.length; i++) {
      if (html.indexOf(errors[i]) !== -1) {
        error = errors[i].substring(7, errors[i].length - 3);
        break;
      }
    }

    return { error, student_id, name };
  } catch (e) {
    console.log(e);
    return Promise.reject(e);
  }
};

// 获取课表
exports.getSchedule = async function (cookie, student_id, teacher) {
  // console.log(213312, cookie, student_id);
  if (!cookie || !student_id) throw '未登录';
  try {
    let response = await axios.get('https://jwc.scnu.edu.cn/xskbcx.aspx?xh=' + student_id, {
      responseType: 'arraybuffer',
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 8_4 like Mac OS X) AppleWebKit/600.1.4 (KHTML, like Gecko) Mobile/12H143',
        'Referer': 'https://jwc.scnu.edu.cn/xs_main.aspx?xh=' + student_id,
        'Cookie': cookie,
      }
    });
    html = iconv.decode(response.data, 'gb2312');

    if (html.indexOf('学生个人课程表') === -1) throw '未登录';

    return schedule.parseCoursesList(html);
  } catch (e) {
    return Promise.reject(e);
  }
};


// 学期的第一个周一的日期
// var firstMonday = "2018-02-26";
var firstMonday = "2018-09-03";

// 组合 ISO 8601 日期
function mergeDateTime(date, time) {
  if (time.split(":")[0].length === 1) {
    time = "0" + time;
  }
  return date + "T" + time + ":00+08:00";
}

// 生成 ics 文件并写入
exports.generateICS = function (list, alarm, teacher) {
  return new Promise(function(resolve, reject) {
    // 初始化
    let cal = ical({
      domain: "jwc.scnu.edu.cn",
      prodId: { company: "South China Normal University", product: "class-schedule" },
      name: "ISCNU Class Schedule",
      timezone: "Asia/Shanghai",
    });
    // 下一步，添加到 ical 对象
    list.forEach(function (course) {
      // console.log("course", course);
      // 开课日期与第一个周一的偏移天数
      var startDayOffset = course.day - 1 + 7 * (course.startWeek - 1);
      // 结课日期与第一个周一的偏移天数
      var endDayOffset = course.day - 1 + 7 * (course.endWeek - 1);
      // 一天的开始时刻
      var startTime = new Date((new Date(mergeDateTime(firstMonday, course.startTime))).getTime() + startDayOffset * 86400000);
      // 一天的结束时刻
      var endTime = new Date((new Date(mergeDateTime(firstMonday, course.endTime))).getTime() + startDayOffset * 86400000);
      var event = cal.createEvent({
        start: startTime,
        end: endTime,
        summary: course.name + (teacher ? ` (${course.teacher})` : ''),
        description: course.teacher + ( course.singleOrDouble === 1 ? "\n单周" : course.singleOrDouble === 2 ? "\n双周" : "" ) + "\n" + "-- Powered by ISCNU",
        location: course.place,
        repeating: {
          freq: 'WEEKLY', // 以周为周期
          interval: course.singleOrDouble === 0 ? 1 : 2, // 单双周
          until: new Date((new Date(mergeDateTime(firstMonday, "23:59"))).getTime() + endDayOffset * 86400000),
        }
      });
      if (alarm) {
        event.createAlarm({ type: 'display', trigger: Math.ceil(alarm * 60) });
      }
    });
    try {
      // console.log(cal.toString());
      let filename = md5(Date.now() + "ISCNU Technology Department") + '.ics';
    
      cal.saveSync('data/ics/' + filename);
      resolve(filename);
    } catch (e) {
      reject(e);
    }
  });
}
