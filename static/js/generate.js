// captcha
let loadingCaptcha = false;
function loadCaptcha() {
  if (!loadingCaptcha) {
    loadingCaptcha = true;
    let icode = document.getElementById('icode');
    icode.style.display = 'none';    
    icode.parentNode.classList.add('is-loading');
    document.getElementById('CheckCode').value = '';
    icode.src = './api/captcha?' + Date.now();
  }
}
document.getElementById('CheckCode').onfocus = function (e) {
  let icode = document.getElementById('icode');
  icode.onload = function () {
    icode.parentNode.classList.remove('is-loading');
    icode.style.display = 'inline-block';
    loadingCaptcha = false;
    // 验证码识别
    if (window.recognizeCaptha)
      window.recognizeCaptha();
  }
  icode.onclick = function () {
    loadCaptcha();
  }
  if (icode.style.display === 'none') {
    loadCaptcha();
  }
}

function resetForm() {
  document.getElementById('username').value = '';
  document.getElementById('password').value = '';
  document.getElementById('CheckCode').value = '';
  document.getElementById('confirm').checked = false;

  let icode = document.getElementById('icode');
  icode.style.display = 'none';
}

// 显示弹窗
window.showModel = function (title, content, cancelBtn) {
  return new Promise(function(resolve, reject) {
    let model = document.createElement("div");
    model.classList.add("model-mask");
    model.innerHTML = `<div class="model-confirm">
      <h3 style="border-bottom: black solid 1px; padding: 0px 0 4px;">${title}</h3>
      <div class="model-content">
      ${content}
      </div>
      <div class="buttons">
        <button class="button"${!cancelBtn ? " style='display: none;'" : ""}>取消</button>
        <button class="button is-small">确定</button>
      </div>
      <div class="close-button">
        <button class="delete"></button>
      </div>
    </div>`;

    // 关闭按钮
    model.getElementsByClassName("close-button")[0].addEventListener("click", function (e) {
      document.body.removeChild(model);
      resolve(false);
    });

    // 确认按钮
    model.getElementsByClassName("button")[1].addEventListener("click", function (e) {
      document.body.removeChild(model);
      resolve(true);
    });

    // 取消按钮
    model.getElementsByClassName("button")[0].addEventListener("click", function (e) {
      document.body.removeChild(model);
      resolve(false);
    });

    // 加入到body末尾
    document.body.appendChild(model);
  });
};

// 步骤指示器
let steps = new bulmaSteps(document.getElementById('gen-steps'));

// fetch
function fetchAPI(url, body) {
  return new Promise(function(resolve, reject) {
    let options = {
      method: 'POST',
      headers: {
        'Accept': 'application/json, text/plain, */*',
        'Content-Type': 'application/json'
      },
      credentials: "same-origin",
    }
    if (body) {
      options.body = JSON.stringify(body);
    }
    fetch(url, options)
      .then((response) => response.json())
      .then(data => {
        if (!data.success) {
          console.log('err', data);
          throw data.msg;
        }
        resolve(data);
      })
      .catch(err => {
        reject(err);
      });
  });
}

// 登录
let loading = false;
document.getElementById('login').addEventListener('click', function (e) {
  let loginBtn = e.target;
  if (loading) return;
  loading = true;
  // loginBtn.disabled = true;
  loginBtn.classList.add('is-loading');

  let username = document.getElementById('username').value;
  let password = document.getElementById('password').value;
  let code = document.getElementById('CheckCode').value;
  let confirm = document.getElementById('confirm').checked;

  // check input data
  try {
    if (!confirm) throw '需要同意选项后才能继续哦';
    if (!username || !password || !code) throw '填写信息不完整，请重试';
    if (!/^\d{11}$/.test(username)) throw '用户名不合规则';
    if (!/^[a-z0-9A-Z]{4}$/.test(code)) throw '验证码不合规则';
  } catch (e) {
    loading = false;
    loginBtn.classList.remove('is-loading');
    showModel('Oops, 出错了', e);
    return;
  }

  // check login
  fetchAPI('./api/login', {
    username,
    password,
    code
  }).then(data => {
    loading = false;
    loginBtn.classList.remove('is-loading');
    console.log(data);
    // 提示下一步
    showModel('登录成功', data.name + '，您好！<br>感谢您对 ISCNU 的信任<br>点击确定按钮进入下一步')
      .then(() => {
        steps.next_step();
      });
  }).catch(err => {
    loading = false;
    loginBtn.classList.remove('is-loading');
    loadCaptcha();
    showModel('Oops, 出错了', err);
  })
});

// 生成日历
// let filename = '';
document.getElementById('generate').addEventListener('click', function (e) {
  let generateBtn = e.target;
  if (loading) return;
  loading = true;
  generateBtn.classList.add('is-loading');

  let alarm = document.getElementById('alarm-setting').value;
  let teacher = document.querySelector('input[name="title-setting"]:checked').value === '1';

  // generate
  fetchAPI('./api/generate_ics', {
    alarm,
    teacher,
  }).then(data => {
    loading = false;
    generateBtn.classList.remove('is-loading');
    console.log(data);
    let filename = data.filename;
    // 生成URL
    let path = window.location.pathname.split('/');
    path.pop();
    path.push('webcal', filename);
    let url = window.location.origin + path.join('/');
    // 设置表单
    document.getElementById('ics-input').value = url;
    document.getElementById('ics-link').href = url;
    // 最后一步
    steps.next_step();
  }).catch(err => {
    loading = false;
    generateBtn.classList.remove('is-loading');
    showModel('Oops, 出错了', err).then(() => {
      steps.start();
      loadCaptcha();
    });
  })
});

// 上一步
document.getElementById('ics-prev').addEventListener('click', function (e) {
  steps.previous_step();
});

// 重来
document.getElementById('ics-reload').addEventListener('click', function (e) {
  resetForm();
  steps.start();
});

