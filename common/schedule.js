const cheerio = require('cheerio');

const places = require('./places');

// 各个校区作息时间安排，来自教务网的数据
const schedule = {
  // 石牌校区
  sp: {
    1: { start: "8:30", end: "9:10" },
    2: { start: "9:20", end: "10:00" },
    3: { start: "10:20", end: "11:00" },
    4: { start: "11:10", end: "11:50" },
    5: { start: "14:30", end: "15:10" },
    6: { start: "15:20", end: "16:00" },
    7: { start: "16:10", end: "16:50" },
    8: { start: "17:00", end: "17:40" },
    9: { start: "19:00", end: "19:40" },
    10: { start: "19:50", end: "20:30" },
    11: { start: "20:40", end: "21:20" },
  },
  // 大学城校区
  dxc: {
    1: { start: "8:30", end: "9:10" },
    2: { start: "9:20", end: "10:00" },
    3: { start: "10:20", end: "11:00" },
    4: { start: "11:10", end: "11:50" },
    5: { start: "14:00", end: "14:40" },
    6: { start: "14:50", end: "15:30" },
    7: { start: "15:40", end: "16:20" },
    8: { start: "16:30", end: "17:10" },
    9: { start: "19:00", end: "19:40" },
    10: { start: "19:50", end: "20:30" },
    11: { start: "20:40", end: "21:20" },
  },
  // 南海校区
  nh: {
    1: { start: "8:15", end: "8:55" },
    2: { start: "9:05", end: "9:45" },
    3: { start: "9:55", end: "10:35" },
    4: { start: "10:45", end: "11:25" },
    5: { start: "14:00", end: "14:40" },
    6: { start: "14:50", end: "15:30" },
    7: { start: "15:40", end: "16:20" },
    8: { start: "16:30", end: "17:10" },
    9: { start: "19:40", end: "20:20" },
    10: { start: "20:30", end: "21:10" },
    11: { start: "21:20", end: "22:00" },
  },
};

// ISO 8601 规定周一是每周的第一天
const dayMap = {
  "周一" : 1,
  "周二" : 2,
  "周三" : 3,
  "周四" : 4,
  "周五" : 5,
  "周六" : 6,
  "周日" : 7,
};

// 解析课程列表
exports.parseCoursesList = function (html) {
  const $ = cheerio.load(html, { decodeEntities: false });
  // 获取到课表中带课程的单元格
  var courseCells = $("td[align=Center]", "#Table1").not('td[width="14%"]')

  // 遍历单元格
  var courses = courseCells.filter(function (i, el) {
    var html = $(el).html();
    return html !== String.fromCharCode(160); // Non-breakable space is char 160
  });

  // 迭代 处理后的单元格
  var courseArr = [];
  courses.each(function (i, el) {
    var courseString = $(el).html().trim();
    var infoArr = courseString.split("<br>");
    // 时间字符串
    // 多种情况，例如：
    // 周二第9,10节{第1-17周}
    // 周一第9,10,11节{第3-17周|单周}
    // 周二第9,10节{第1-17周|2节/周}
    var timeStr = infoArr[2];
    // 星期几
    var day = dayMap[timeStr.substr(0, 2)];
    // 第几节课
    var order = timeStr.match(/第(.*?)节/)[1].split(',');
    // 起始和终止周次，单双周
    var weekArr = timeStr.match(/\{.*\}/g)[0].split('|');
    var week = weekArr[0].match(/第(\d*?)-(\d*?)周/);
    // 0: 不分，1: 单周，2: 双周
    var singleOrDouble = weekArr[1] === "单周" ? 1 : weekArr[1] === "双周" ? 2 : 0;
    var info = {
      name: infoArr[0], // 课程名
      type: infoArr[1], // 课程类型：必修/选修/公选
      day, // 星期几
      order, // 上课节次
      startWeek: week[1], // 开始周
      endWeek: week[2], // 结束周
      singleOrDouble, // 单双周
      teacher: infoArr[3], // 教师名
      place: infoArr[4].trim(), // 上课地点
    };
    courseArr.push(info);
  });

  // 合并同一天，地点相同的同一课程
  var mergedCourseArr = [];
  courseArr.forEach(function (v, i) {
    var push = true;
    var campus = places[v.place] || 'sp';
    for (var j = 0; j < mergedCourseArr.length; j++) {
      // console.log(mergedCourseArr);
      if (mergedCourseArr[j].day === v.day && mergedCourseArr[j].name === v.name && mergedCourseArr[j].place === v.place) {
        mergedCourseArr[j].order = mergedCourseArr[j].order.concat(v.order);
        push = false;
        mergedCourseArr[j].endTime = schedule[campus][v.order[v.order.length - 1]].end // 更新课程结束时间
        break;
      }
    }
    if (push) {
      v.startTime = schedule[campus][v.order[0]].start; // 课程开始时间
      v.endTime = schedule[campus][v.order[v.order.length - 1]].end // 课程结束时间
      mergedCourseArr.push(v);
    }
  });

  return mergedCourseArr;
};
