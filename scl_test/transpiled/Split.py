import math

def Split(context, global_dbs):
    # Return Type: Void
    # VAR_INPUT:
    #   string_in: String
    #   delimeter: String
    #   pointer: Int
    # VAR_IN_OUT:
    #   sub_strings: Array[*] of String
    # VAR_TEMP:
    #   _split: String
    #   _position: Int
    #   _return: String
    context['REGION']
    global_dbs['GET POSITION OF DELIMETER IN STRING']
    context['_position'] = FIND(IN1=context['string_in'], IN2=context['delimeter'])
    context['END_REGION']
    context['REGION']
    global_dbs['BASE CASE']
    if (context['_position'] == 0):
        context['sub_strings'][int(context['pointer'])] = context['string_in']
        return
    context['END_REGION']
    context['REGION']
    global_dbs['RECURSIVE CASE']
    context['sub_strings'][int(context['pointer'])] = LEFT(IN=context['string_in'], L=(context['_position'] - 1))
    Split(string_in=RIGHT(IN=context['string_in'], L=(LEN(context['string_in']) - context['_position'])), delimeter=context['delimeter'], pointer=(context['pointer'] + 1), sub_strings=context['sub_strings'])
    context['END_REGION']
