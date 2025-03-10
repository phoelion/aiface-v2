export enum MessagesEnum {
  NEW_USER = '👤new user {{id}}\n📍country: {{country}}\n#new_user',
  PREV_USER = '👤user returned {{id}}\n📍country: {{country}}\n#prev_user',

  FAILED_SWAP = '🐙 {{user}} failed to get response\nreason: {{reason}}',
  SUCCESS_SWAP = '🐬 {{user}} tried successfully',

  RESULT = '📹{{id}}\n get the result\ntaskId: {{taskId}}\nprompt: {{prompt}}\nrequestedTimes: {{requestedTimes}}\noutput: {{output}}\n#generate_result',
  PURCHASE = '🤑{{id}}\nbought a {{plan}} plan\n#purchase',
  GENERAL_PURCHASE = '🤑Video Generator IOS Soled a {{plan}}\n',
  CONTACT_US = '📥 ContactUs\n{{user}} said:\n{{message}}\n',
}
