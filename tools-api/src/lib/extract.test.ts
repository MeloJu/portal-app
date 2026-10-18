import { describe, expect, it } from "vitest";
import { extractDestinationFromHtml } from "./extract.ts";

const page = new URL("https://encurta.com/abc");
const extract = (html: string, allowScript = true) => extractDestinationFromHtml(html, page, { allowScript })?.href ?? null;

describe("extractDestinationFromHtml", () => {
  it("lê o meta refresh", () => {
    expect(extract('<meta http-equiv="refresh" content="0; url=https://exemplo.com/x">')).toBe("https://exemplo.com/x");
    expect(extract("<META HTTP-EQUIV=Refresh CONTENT='5;URL=\"https://exemplo.com/y\"'>")).toBe("https://exemplo.com/y");
  });

  it("desfaz entidades HTML no meta refresh", () => {
    expect(extract('<meta http-equiv="refresh" content="0;url=https://exemplo.com/?a=1&amp;b=2">')).toBe(
      "https://exemplo.com/?a=1&b=2",
    );
  });

  it("resolve meta refresh relativo à página", () => {
    expect(extract('<meta http-equiv="refresh" content="0;url=/destino">')).toBe("https://encurta.com/destino");
  });

  it("lê redirecionamentos em script", () => {
    expect(extract('<script>window.location.href = "https://exemplo.com/a";</script>')).toBe("https://exemplo.com/a");
    expect(extract("<script>location.replace('https://exemplo.com/b')</script>")).toBe("https://exemplo.com/b");
    expect(extract('<script>top.location="https:\\/\\/exemplo.com\\/c"</script>')).toBe("https://exemplo.com/c");
    expect(extract('<script>location.assign("https\\x3a\\u002f\\u002fexemplo.com/d")</script>')).toBe("https://exemplo.com/d");
  });

  it("ignora script quando não é permitido", () => {
    expect(extract('<script>location.href = "https://exemplo.com/a"</script>', false)).toBeNull();
  });

  it("ignora template com interpolação, esquemas perigosos e a própria página", () => {
    expect(extract("<script>location.href = `https://${host}/x`</script>")).toBeNull();
    expect(extract('<script>location.href = "javascript:void(0)"</script>')).toBeNull();
    expect(extract('<meta http-equiv="refresh" content="0;url=https://encurta.com/abc">')).toBeNull();
  });

  it("devolve null quando a página não redireciona", () => {
    expect(extract("<html><body><a href='https://exemplo.com'>clique</a></body></html>")).toBeNull();
  });
});
