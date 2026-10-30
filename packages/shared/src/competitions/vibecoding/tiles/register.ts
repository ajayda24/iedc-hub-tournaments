import { frag, norm, visible, type CheckPage, type TileDefinition } from "../checks";

const DEPTS = ["CSE", "ECE", "EEE", "ME", "CE", "IT"];

const html = (depts = DEPTS) => `<h2>Register</h2>
<form data-hook="reg-form" novalidate>
  <label>Name <input data-hook="reg-name" name="name" autocomplete="off"></label>
  <label>Email <input data-hook="reg-email" name="email" type="email" autocomplete="off"></label>
  <label>Department
    <select data-hook="reg-dept" name="dept">
      <option value="">Choose…</option>
${depts.map((d) => `      <option value="${d}">${d}</option>`).join("\n")}
    </select>
  </label>
  <button type="submit">Register</button>
  <p class="err" data-hook="reg-error" hidden></p>
  <p class="ok" data-hook="reg-success" hidden></p>
</form>`;

const css = `#tile-register form{display:grid;gap:10px;max-width:420px;margin:0 auto;background:var(--card);padding:16px;border-radius:14px;border:2px solid var(--fg)}
#tile-register label{display:grid;gap:4px;font-weight:600}
#tile-register input,#tile-register select{padding:8px;border-radius:8px;border:1px solid #999;font:inherit}
#tile-register button{padding:10px;border-radius:999px;border:0;background:var(--accent);color:#fff;font-weight:700}
#tile-register .err{color:#c0392b;font-weight:700}
#tile-register .ok{color:#1e8449;font-weight:700}`;

/** opts: which rules the form enforces, and how it thanks. */
const js = (opts: { requireAll?: boolean; checkFormat?: boolean; thanks?: string } = {}) => `(function () {
  var root = document.getElementById("tile-register");
  var form = root.querySelector('[data-hook="reg-form"]');
  function q(h) { return root.querySelector('[data-hook="' + h + '"]'); }
  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var name = q("reg-name").value.trim();
    var email = q("reg-email").value.trim();
    var dept = q("reg-dept").value;
    var err = q("reg-error"), ok = q("reg-success");
    var problem = "";
    ${opts.requireAll === false ? "" : 'if (!name || !email) problem = "Please fill in your name and email.";'}
    ${opts.checkFormat === false ? "" : 'if (!problem && email && !/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email)) problem = "Please enter a valid email.";'}
    if (problem) {
      err.textContent = problem; err.hidden = false; ok.hidden = true; ok.textContent = "";
    } else {
      ok.textContent = ${opts.thanks ?? '"Thanks, " + name + "!"'}; ok.hidden = false; err.hidden = true; err.textContent = "";
    }
  });
})();`;

const fill = (p: CheckPage, name: string, email: string, pickDept: boolean) => {
  p.setValue(p.hook("reg-name"), name);
  p.setValue(p.hook("reg-email"), email);
  const sel = p.hook("reg-dept");
  if (pickDept && sel?.tagName === "SELECT") {
    const first = [...(sel as HTMLSelectElement).options].find((o) => o.value.trim());
    if (first) p.setValue(sel, first.value);
  } else if (pickDept && sel) p.setValue(sel, "CSE");
  p.submit(p.hook("reg-form") ?? p.hook("reg-name")?.closest("form"));
};

const isField = (el: Element | null) => !!el && /^(INPUT|SELECT|TEXTAREA)$/.test(el.tagName);

/** T4 Registration form. */
export const register: TileDefinition = {
  id: "register",
  starter: () => frag(""),
  reference: () => frag(html(), css, js()),
  bad: [
    { fails: "dept", fragment: frag(html(DEPTS.slice(0, 4)), css, js()) },
    { fails: "empty", fragment: frag(html(), css, js({ requireAll: false })) },
    { fails: "bademail", fragment: frag(html(), css, js({ checkFormat: false })) },
    { fails: "success", fragment: frag(html(), css, js({ thanks: '"Registered!"' })) },
    { fails: "fields", variant: "simple", fragment: frag(html().replace(/<label>Email[^\n]*\n/, ""), css, js().replace('var email = q("reg-email").value.trim();', 'var email = "x@y.z";')) },
    { fails: "success", variant: "simple", fragment: frag(html(), css, js({ thanks: '"Registered!"' })) },
  ],
  checks: {
    fields: { run: (p) => isField(p.hook("reg-name")) && isField(p.hook("reg-email")) && isField(p.hook("reg-dept")) },
    dept: {
      run: (p) => {
        const sel = p.hook("reg-dept");
        return sel?.tagName === "SELECT" && [...(sel as HTMLSelectElement).options].filter((o) => o.value.trim() && o.textContent?.trim()).length >= 5;
      },
    },
    empty: {
      run: (p) => {
        p.submit(p.hook("reg-form") ?? p.hook("reg-name")?.closest("form"));
        return visible(p, p.hook("reg-error")) && !visible(p, p.hook("reg-success"));
      },
    },
    bademail: {
      run: (p) => {
        fill(p, "Asha", "asha", true);
        return visible(p, p.hook("reg-error")) && !visible(p, p.hook("reg-success"));
      },
    },
    success: {
      run: (p) => {
        fill(p, "Asha", "asha@example.com", true);
        const ok = p.hook("reg-success");
        return visible(p, ok) && norm(ok?.textContent).includes("asha") && !visible(p, p.hook("reg-error"));
      },
    },
  },
};
