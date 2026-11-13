window.__ModuleLoader__.load({
  id: "@local/dsh-hifleet-tools",
  factory: (require) => {
    var module = { exports: {} };
    var React = require("react");

    var NS = "hifleet";
    var API = "/dsh-hifleet/api";

    var zh = {
      nav: "HiFleet 账号",
      title: "HiFleet 账号",
      hint: "保存后，DSH 里的 HiFleet 工具会在下一次调用时自动用这个账号登录，不需要重启 DSH。账号密码只保存在本机 %USERPROFILE%\\.hifleet\\credentials.json。",
      storedFor: "设置页保存的账号：",
      none: "尚未保存账号",
      sessionFor: "当前 HiFleet 会话：",
      noSession: "当前没有登录会话（匿名也能调用部分公开接口）",
      username: "用户名 / 手机号 / 邮箱",
      password: "密码",
      save: "保存账号",
      clear: "删除已保存账号",
      saved: "已保存。旧的登录会话已清除，下一次调用 HiFleet 工具时会用这个账号重新登录。",
      cleared: "已删除已保存的账号。",
      needBoth: "请同时填写用户名和密码。",
      loading: "正在读取状态…",
      unavailable: "读取状态失败：",
      saving: "保存中…",
      clearing: "删除中…",
    };

    var en = {
      nav: "HiFleet account",
      title: "HiFleet account",
      hint: "After saving, HiFleet tools in DSH sign in with this account on their next call — no DSH restart needed. Credentials are stored locally in %USERPROFILE%\\.hifleet\\credentials.json.",
      storedFor: "Saved account: ",
      none: "no account saved",
      sessionFor: "Current HiFleet session: ",
      noSession: "no signed-in session (some public endpoints work anonymously)",
      username: "Username / phone / email",
      password: "Password",
      save: "Save account",
      clear: "Delete saved account",
      saved: "Saved. The old session was cleared; HiFleet tools will sign in with this account on their next call.",
      cleared: "Saved account deleted.",
      needBoth: "Fill in both the username and the password.",
      loading: "Loading…",
      unavailable: "Could not read the status: ",
      saving: "Saving…",
      clearing: "Deleting…",
    };

    // The Client locale service takes over once apply() runs.
    var translate = function (key) {
      return typeof zh[key] === "string" ? zh[key] : key;
    };

    function h(type, props) {
      var children = Array.prototype.slice.call(arguments, 2);
      return React.createElement.apply(null, [type, props].concat(children));
    }

    var textStyle = { margin: 0, opacity: 0.72, fontSize: 13, lineHeight: 1.6 };
    var labelStyle = {
      display: "flex",
      flexDirection: "column",
      gap: 6,
      fontSize: 13,
      lineHeight: 1.5,
      maxWidth: 420,
    };
    var inputStyle = {
      width: "100%",
      boxSizing: "border-box",
      padding: "7px 10px",
      fontSize: 14,
      lineHeight: "20px",
      color: "inherit",
      background: "transparent",
      border: "1px solid rgba(127,127,127,0.45)",
      borderRadius: 8,
      fontFamily: "inherit",
    };
    var buttonStyle = function (primary) {
      return {
        cursor: "pointer",
        padding: "7px 16px",
        fontSize: 14,
        lineHeight: "22px",
        color: primary ? "#ffffff" : "inherit",
        background: primary ? "#0B5FFF" : "transparent",
        border: primary ? "1px solid #0B5FFF" : "1px solid rgba(127,127,127,0.45)",
        borderRadius: 8,
        fontFamily: "inherit",
      };
    };
    var okStyle = { margin: 0, color: "#2e7d32", fontSize: 13, lineHeight: 1.6 };
    var badStyle = { margin: 0, color: "#c0392b", fontSize: 13, lineHeight: 1.6 };

    function AccountPanel(titled) {
      return function HifleetAccountPanel(props) {
        var view = props !== null && props !== undefined && typeof props.view === "string" ? props.view : undefined;
        var statusState = React.useState(null);
        var status = statusState[0];
        var setStatus = statusState[1];
        var errorState = React.useState(null);
        var error = errorState[0];
        var setError = errorState[1];
        var loadingState = React.useState(true);
        var loading = loadingState[0];
        var setLoading = loadingState[1];
        var userState = React.useState("");
        var username = userState[0];
        var setUsername = userState[1];
        var passState = React.useState("");
        var password = passState[0];
        var setPassword = passState[1];
        var busyState = React.useState("");
        var busy = busyState[0];
        var setBusy = busyState[1];
        var noticeState = React.useState(null);
        var notice = noticeState[0];
        var setNotice = noticeState[1];
        var failureState = React.useState(null);
        var failure = failureState[0];
        var setFailure = failureState[1];

        var load = React.useCallback(function () {
          setLoading(true);
          setError(null);
          fetch(API + "/status", {
            headers: { accept: "application/json" },
            credentials: "same-origin",
          })
            .then(function (response) {
              return response.json().then(function (body) {
                return { ok: response.ok, body: body };
              });
            })
            .then(function (result) {
              if (!result.ok || !result.body || result.body.ok !== true) {
                throw new Error((result.body && result.body.error) || "HTTP error");
              }
              setStatus(result.body);
              setLoading(false);
            })
            .catch(function (cause) {
              setError(String((cause && cause.message) || cause));
              setLoading(false);
            });
        }, []);

        React.useEffect(function () {
          load();
        }, [load]);

        function save() {
          var name = username.trim();
          if (name === "" || password === "") {
            setFailure(translate("needBoth"));
            setNotice(null);
            return;
          }
          setBusy("save");
          setFailure(null);
          setNotice(null);
          fetch(API + "/credentials", {
            method: "POST",
            headers: {
              "content-type": "application/json",
              accept: "application/json",
              "x-dsh-hifleet": "1",
            },
            credentials: "same-origin",
            body: JSON.stringify({ username: name, password: password }),
          })
            .then(function (response) {
              return response.json().then(function (body) {
                return { ok: response.ok, body: body };
              });
            })
            .then(function (result) {
              if (!result.ok || !result.body || result.body.ok !== true) {
                throw new Error((result.body && (result.body.message || result.body.error)) || "HTTP error");
              }
              setStatus(result.body);
              setPassword("");
              setUsername("");
              setNotice(translate("saved"));
            })
            .catch(function (cause) {
              setFailure(String((cause && cause.message) || cause));
            })
            .then(function () {
              setBusy("");
            });
        }

        function clear() {
          setBusy("clear");
          setFailure(null);
          setNotice(null);
          fetch(API + "/credentials", {
            method: "DELETE",
            headers: { accept: "application/json", "x-dsh-hifleet": "1" },
            credentials: "same-origin",
          })
            .then(function (response) {
              return response.json().then(function (body) {
                return { ok: response.ok, body: body };
              });
            })
            .then(function (result) {
              if (!result.ok || !result.body || result.body.ok !== true) {
                throw new Error((result.body && (result.body.message || result.body.error)) || "HTTP error");
              }
              setStatus(result.body);
              setNotice(translate("cleared"));
            })
            .catch(function (cause) {
              setFailure(String((cause && cause.message) || cause));
            })
            .then(function () {
              setBusy("");
            });
        }

        if (view === "summary") return null;

        var current = status !== null && status.credentials !== undefined ? status.credentials : null;
        var session = status !== null && status.session !== undefined ? status.session : null;
        var rows = [];
        rows.push(h("h3", { key: "title", style: { margin: 0, fontSize: 16, fontWeight: 600 } }, translate("title")));
        rows.push(h("p", { key: "hint", style: textStyle }, translate("hint")));

        if (loading) {
          rows.push(h("p", { key: "loading", style: textStyle }, translate("loading")));
        } else if (error !== null) {
          rows.push(h("p", { key: "error", style: badStyle }, translate("unavailable") + error));
        } else if (status !== null) {
          rows.push(
            h(
              "p",
              { key: "stored", style: textStyle },
              translate("storedFor") + (current !== null && current.configured === true ? current.username : translate("none")),
            ),
          );
          rows.push(
            h(
              "p",
              { key: "session", style: textStyle },
              session !== null && session.exists === true
                ? translate("sessionFor") + (session.username || "?")
                : translate("noSession"),
            ),
          );
          rows.push(
            h(
              "label",
              { key: "username", style: labelStyle },
              translate("username"),
              h("input", {
                type: "text",
                value: username,
                autoComplete: "username",
                spellCheck: false,
                style: inputStyle,
                disabled: busy !== "",
                onChange: function (event) {
                  setUsername(event.target.value);
                },
              }),
            ),
          );
          rows.push(
            h(
              "label",
              { key: "password", style: labelStyle },
              translate("password"),
              h("input", {
                type: "password",
                value: password,
                autoComplete: "current-password",
                style: inputStyle,
                disabled: busy !== "",
                onChange: function (event) {
                  setPassword(event.target.value);
                },
              }),
            ),
          );
          rows.push(
            h(
              "div",
              { key: "actions", style: { display: "flex", gap: 10, flexWrap: "wrap", marginTop: 4 } },
              h(
                "button",
                {
                  type: "button",
                  style: buttonStyle(true),
                  disabled: busy !== "",
                  onClick: save,
                },
                busy === "save" ? translate("saving") : translate("save"),
              ),
              h(
                "button",
                {
                  type: "button",
                  style: buttonStyle(false),
                  disabled: busy !== "" || current === null || current.configured !== true,
                  onClick: clear,
                },
                busy === "clear" ? translate("clearing") : translate("clear"),
              ),
            ),
          );
          if (notice !== null) rows.push(h("p", { key: "notice", style: okStyle }, notice));
          if (failure !== null) rows.push(h("p", { key: "failure", style: badStyle }, failure));
        }

        return h(
          "div",
          {
            key: "root",
            style: {
              display: "flex",
              flexDirection: "column",
              gap: 10,
              padding: titled === true ? "20px 8px" : "4px 0",
            },
          },
          rows,
        );
      };
    }

    function apply(ctx) {
      ctx.effect(function () {
        return ctx.locale.register(NS, { zh: zh, en: en });
      }, "hifleet: dictionaries");
      var t = ctx.locale.bind(NS);
      translate = t;
      ctx.slots.inject("settings.section", function () {
        return ctx.slots.register(
          {
            name: "settings.section",
            id: "hifleet-account",
            order: 110,
            label: function () {
              return translate("nav");
            },
            locale: NS,
          },
          AccountPanel(true),
        );
      });
      ctx.slots.inject("plugins.bundle.config", function () {
        return ctx.slots.register(
          { name: "plugins.bundle.config", key: "@local/dsh-hifleet-tools", locale: NS },
          AccountPanel(false),
        );
      });
    }

    module.exports = { inject: ["slots", "locale"], apply: apply };
    return module.exports;
  },
});
