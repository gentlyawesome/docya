// Reads the newest email sent to EMAIL from the LOCAL Supabase mail catcher (Mailpit) and
// returns the 6-digit code in it as output.code. Never talks to a real mailbox.
var base = 'http://127.0.0.1:54324/api/v1';
var found = json(http.get(base + '/search?query=' + encodeURIComponent('to:' + EMAIL)).body);
if (!found.messages || found.messages.length === 0) {
  throw new Error('No email arrived for ' + EMAIL);
}
var message = json(http.get(base + '/message/' + found.messages[0].ID).body);
var text = String(message.Text || '') + ' ' + String(message.HTML || '').replace(/<[^>]*>/g, ' ');
var match = /(?:^|\D)(\d{6})(?:\D|$)/.exec(text);
if (!match) {
  throw new Error('No 6-digit code found in the email');
}
output.code = match[1];
