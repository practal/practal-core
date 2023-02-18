import { debug } from "../things/debug";
import { assertEQ, assertEq, assertIsDefined, assertIsUndefined, assertLESS, assertTrue, assertUNRELATED, Test } from "../things/test";
import { Version, VersionRange, Versions } from "./version";

Test(() => {
    const v = Version.parse("main.1@alpha.7.3");
    assertIsDefined(v);
    assertEq(v.toString(), "main.1@alpha.7.3");
    assertTrue(v.release.length === 2 && v.prerelease.length === 3);
    assertTrue(v.release[0].toString() === "main" && v.release[1] === 1);
    assertTrue(v.prerelease[0].toString() === "alpha" && v.prerelease[1] === 7 && v.prerelease[2] === 3);
});

Test(() => {
    const v = Versions.parse("main.1@alpha.7.3");
    assertIsDefined(v);
    assertEq(v.toString(), "main.1@alpha.7.3");
});

Test(() => {
    const v1 = Version.parse("1.2.pre-alpha");
    const v2 = Version.parse("1.2.pre-alpha.10");
    const v3 = Version.parse("1.2.pre-alpha.01");
    const v4 = Version.parse("1.2.alpha");
    const v5 = Version.parse("1.2.3");
    assertIsDefined(v1);
    assertIsDefined(v2);
    assertIsUndefined(v3);
    assertIsDefined(v4);
    assertIsDefined(v5);
    assertLESS(Version.thing, v1, v2);
    assertUNRELATED(Version.thing, v1, v4, v5);
});

Test(() => {
    const v = Version.parse("1.2.pre-alpha");
    assertIsDefined(v);
    assertTrue(v.release.length === 3 && v.release[0] === 1 && 
        v.release[1] === 2 && v.release[2].toString() === "pre-alpha" && v.prerelease.length === 0);
    assertEq(v.toString(), "1.2.pre-alpha");
});

Test(() => {
    const v1 = Version.parse("1.2");
    const v2 = Version.parse("1.2.0");
    const v3 = Version.parse("1.2.7");
    assertIsDefined(v1);
    assertIsUndefined(v2);
    assertIsDefined(v3);
    assertLESS(Version.thing, v1, v3);
});

Test(() => {
    const v1 = Version.parse("1.2.pre-alpha");
    const v2 = Version.parse("1.2.prealpha");
    const v3 = Version.parse("1.2.PREALPHA");
    const v4 = Version.parse("1.2.PR-EALPH-a");
    const v5 = Version.parse("1.2.pre--alpha");
    const v6 = Version.parse("1.2.pre-alpha-");
    const v7 = Version.parse("1.2.-pre-alpha");
    assertIsDefined(v1);
    assertIsDefined(v2);
    assertIsDefined(v3);
    assertIsDefined(v4);
    assertIsUndefined(v5);
    assertIsUndefined(v6);
    assertIsUndefined(v7);
    assertEQ(Version.thing, v1, v2, v3, v4);
});

Test(() => {
    const v1 = Version.parse("1.2.7p");
    const v2 = Version.parse("1.2.p7");
    assertIsUndefined(v1);
    assertIsDefined(v2);
});

Test(() => {
    const u = Version.parse("@7");
    const v = Version.parse("@");
    const w = Version.parse("@alpha");
    assertIsUndefined(u);
    assertIsUndefined(v);
    assertIsUndefined(w);
});

Test(() => {
    const u = Version.parse("1@alpha.34.test");
    const v = Version.parse("1@alpha.87.test");
    const w = Version.parse("1");
    const x = Version.parse("1@");
    assertIsDefined(u);
    assertIsDefined(v);
    assertIsDefined(w);
    assertIsUndefined(x);
    assertLESS(Version.thing, u, v, w);
});

Test(() => {
    const u = VersionRange.parse(">=1   <2");
    const v = VersionRange.parse("<2>=1");
    const w = VersionRange.parse("<= 2 > 1");
    assertIsDefined(u);
    assertIsDefined(v);
    assertIsDefined(w);
    assertEq(u.toString(), "≥1 <2");
    assertEq(v.toString(), "≥1 <2");
    assertEq(w.toString(), ">1 ≤2");
});

Test(() => {
    const u = VersionRange.parse(">= 1");
    const v = VersionRange.parse("<2");
    const w = VersionRange.parse("<= 7");
    const x = VersionRange.parse(">8");
    assertIsDefined(u);
    assertIsDefined(v);
    assertIsDefined(w);
    assertIsDefined(x);
    assertEq(u.toString(), "≥1");
    assertEq(v.toString(), "<2");
    assertEq(w.toString(), "≤7");
    assertEq(x.toString(), ">8");
});

Test(() => {
    const u = Versions.parse(">=25 | 8 | >= alpha.4 <alpha.5");
    assertIsDefined(u);
    assertTrue(u instanceof Versions);
    assertEq(u.toString(), "≥25 | 8 | ≥alpha.4 <alpha.5");
});



