import test from 'node:test';
import assert from 'node:assert/strict';
import {warrantySettings,watchedEnough} from '../lib/warranty.ts';
import {questions,sanitizeAnswers} from '../lib/experience.ts';
test('warranty video requires HTTPS MP4 and a bounded duration',()=>{
 assert.deepEqual(warrantySettings({video_url:'',video_seconds:200,extra_text:' Texto '}),{p_video:'',p_seconds:0,p_extra:'Texto'});
 assert.equal(warrantySettings({video_url:'https://example.com/video.mp4',video_seconds:180}).p_seconds,180);
 for(const url of ['http://example.com/v.mp4','https://example.com/watch','https://user:secret@example.com/v.mp4','javascript:alert(1)'])assert.throws(()=>warrantySettings({video_url:url,video_seconds:180}));
 for(const duration of [0,9,1201,15.5])assert.throws(()=>warrantySettings({video_url:'https://example.com/v.mp4',video_seconds:duration}));
 assert.throws(()=>warrantySettings({extra_text:'x'.repeat(4001)}));
});
test('video confirmation waits for full playback with one second tolerance',()=>{assert.equal(watchedEnough(0,0),true);assert.equal(watchedEnough(178,180),false);assert.equal(watchedEnough(179,180),true)});
test('referral branches require consent and discard obsolete contact details',()=>{
 assert.ok(questions({referral_choice:'Sim, indicar agora'}).some(q=>q.key==='referral_permission'&&!q.optional));
 assert.ok(!questions({referral_choice:'Sim, mais tarde'}).some(q=>q.key==='referral_phone'));
 assert.equal(sanitizeAnswers({referral_choice:'Sim, indicar agora',referral_name:' Maria ',referral_phone:'(12) 99999-1234',referral_permission:'Sim, a pessoa autorizou o contato'}).referral_phone,'5512999991234');
 assert.throws(()=>sanitizeAnswers({referral_choice:'Sim, indicar agora',referral_phone:'123'}));
 assert.throws(()=>sanitizeAnswers({referral_choice:'Sim, indicar agora',referral_permission:'Não'}));
 const clean=sanitizeAnswers({referral_choice:'Não neste momento',referral_name:'obsolete',referral_phone:'5512999991234',referral_reminder:'Sim, pode me lembrar pelo WhatsApp'});
 assert.equal(clean.referral_phone,undefined);assert.equal(clean.referral_reminder,undefined);
});
