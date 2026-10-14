import { describe, expect, it } from "vitest";
import { isPrivateIp, parsePublicUrl } from "./ssrf.ts";

describe("isPrivateIp", () => {
  it.each(["127.0.0.1", "10.0.0.5", "172.16.0.1", "172.31.255.255", "192.168.1.1", "169.254.169.254", "0.0.0.0", "100.64.0.1", "::1", "fd00::1", "fe80::1", "::ffff:127.0.0.1"])(
    "bloqueia %s",
    (ip) => expect(isPrivateIp(ip)).toBe(true),
  );

  it.each(["8.8.8.8", "1.1.1.1", "172.32.0.1", "2606:4700:4700::1111"])("permite %s", (ip) =>
    expect(isPrivateIp(ip)).toBe(false),
  );
});

describe("parsePublicUrl", () => {
  it("adiciona https:// quando não há esquema", () => {
    expect(parsePublicUrl("bit.ly/abc").href).toBe("https://bit.ly/abc");
  });

  it.each([undefined, "", "   ", 42, "javascript:alert(1)", "ftp://x.com", "file:///etc/passwd"])(
    "recusa %j",
    (value) => expect(() => parsePublicUrl(value)).toThrow(),
  );

  it.each(["http://localhost/x", "http://127.0.0.1/", "http://[::1]/", "http://10.1.2.3/", "http://169.254.169.254/latest", "http://app.internal/"])(
    "recusa host interno %s",
    (value) => expect(() => parsePublicUrl(value)).toThrow(/não é permitido/),
  );

  it("recusa URL acima de 2048 caracteres", () => {
    expect(() => parsePublicUrl(`https://a.com/${"x".repeat(2100)}`)).toThrow();
  });
});
