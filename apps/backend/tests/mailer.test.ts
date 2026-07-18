import assert from "node:assert/strict";
import test from "node:test";
import {
  buildAccountActivatedEmail,
  buildEmailVerificationEmail,
  buildPasswordResetEmail
} from "../src/lib/mailer.js";

test("all account emails use the same D&D Recorder design and Artificer voice", () => {
  const emails = [
    buildEmailVerificationEmail("Alrik", "https://dndbot.example.com/verify-email?token=abc"),
    buildAccountActivatedEmail("Alrik", "https://dndbot.example.com/login"),
    buildPasswordResetEmail("Alrik", "https://dndbot.example.com/reset-password?token=abc")
  ];

  for (const email of emails) {
    assert.match(email.subject, /D&D Recorder/);
    assert.match(email.text, /Hallo Alrik,/);
    assert.match(email.text, /Dein Artificer · D&D Recorder/);
    assert.match(email.html, /Botschaft des Artificers/);
    assert.match(email.html, /background:#0f0f1a/);
    assert.match(email.html, /background:#7c3aed/);
    assert.match(email.html, /D&amp;D Recorder/);
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
