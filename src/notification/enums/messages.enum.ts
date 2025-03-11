export enum MessagesEnum {
  NEW_USER = '👤new user {{id}}\n📍country: {{country}}\n#new_user',
  PREV_USER = '👤user returned {{id}}\n📍country: {{country}}\n#prev_user',

  FAILED_SWAP = '🐙 {{user}} failed to get response\nreason: {{reason}}',
  SUCCESS_SWAP = '🐬 {{user}} tried successfully',

  NORMAL_SWAP = '🦢user {{id}}\ntried normal swap\ntoBeConsumedCredits: {{toBeConsumedCredits}}\n#normal_swap',
  TEMPLATE_SWAP = '🕹️user {{id}}\ntried template swap\ntoBeConsumedCredits: {{toBeConsumedCredits}}\n#video_template_swap',
  SWAP_RESULT = '🕹️user {{id}}\ngot result\n#video_swap_result',
  RESULT = '📹{{id}}\n get the result\n#swap_result',

  PURCHASE = '🤑{{id}}\nbought a {{plan}} plan\n#purchase',
  GENERAL_PURCHASE = '🤑AiFace Soled a {{plan}}\n',
  CONTACT_US = '📥 ContactUs\n{{user}} said:\n{{message}}\n',
}
