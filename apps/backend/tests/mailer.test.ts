import assert from "node:assert/strict";
import test from "node:test";
import {
  buildAccountActivatedEmail,
  buildEmailConfirmedEmail,
  buildEmailVerificationEmail,
  buildPasswordResetEmail
} from "../src/lib/mailer.js";

test("all account emails use the same DnD Recorder design and Artificer voice", () => {
  const emails = [
    buildEmailVerificationEmail("Alrik", "https://dndbot.example.com/verify-email?token=abc"),
    buildEmailConfirmedEmail("Alrik"),
    buildAccountActivatedEmail("Alrik", "https://dndbot.example.com/login"),
    buildPasswordResetEmail("Alrik", "https://dndbot.example.com/reset-password?token=abc")
  ];

  for (const email of emails) {
    assert.match(email.subject, /DnD Recorder/);
    assert.match(email.text, /Hallo Alrik,/);
    assert.match(email.text, /Dein Artificer · DnD Recorder/);
    assert.match(email.html, /Botschaft des Artificers/);
    assert.match(email.html, /background:#0f0f1a/);
    assert.match(email.html, /alt="DnD Recorder"/);
    assert.match(email.html, /logo-d20\.png/);
  }

  for (const email of [emails[0]!, emails[2]!, emails[3]!]) {
    assert.match(email.html, /background:#7c3aed/);
  }
});

test("the branded HTML escapes user-controlled names and action URLs", () => {
  const email = buildEmailVerificationEmail(
    '<Dungeon & "Master">',
    'https://dndbot.example.com/verify-email?token=a&next="danger"'
  );

  assert.doesNotMatch(email.html, /<Dungeon/);
  assert.match(email.html, /&lt;Dungeon &amp; &quot;Master&quot;&gt;/);
  assert.match(email.html, /token=a&amp;next=&quot;danger&quot;/);
});

test("transactional email copy states each token lifetime", () => {
  const verification = buildEmailVerificationEmail("Alrik", "https://example.com/verify");
  const passwordReset = buildPasswordResetEmail("Alrik", "https://example.com/reset");

  assert.match(verification.text, /24 Stunden/);
  assert.match(verification.text, /nur einmal/);
  assert.match(passwordReset.text, /30 Minuten/);
  assert.match(passwordReset.text, /nur einmal/);
});

test("beta onboarding emails distinguish confirmation from manual approval", () => {
  const confirmed = buildEmailConfirmedEmail("Alrik");
  const activated = buildAccountActivatedEmail("Alrik", "https://example.com/login");

  assert.match(confirmed.subject, /Freigabe ausstehend/);
  assert.match(confirmed.text, /Obere Artificer/);
  assert.match(confirmed.text, /manuell frei/);
  assert.doesNotMatch(confirmed.text, /Konto ist jetzt aktiviert/);
  assert.match(activated.text, /freigeschaltet/);
  assert.match(activated.text, /jetzt aktiviert/);
});
