import math

def WString_Split_Single(context, global_dbs):
    # Return Type: Void
    # VAR_INPUT:
    #   wstring_in: WString
    #   delimeter: WString
    #   pointer: Int
    # VAR_IN_OUT:
    #   sub_strings: Array[*] of WString
    # VAR_TEMP:
    #   _split: WString
    #   _position: Int
    #   _return: WString
    context['REGION']
    global_dbs['GET POSITION OF DELIMETER IN STRING']
    context['_position'] = FIND(IN1=context['wstring_in'], IN2=context['delimeter'])
    context['END_REGION']
    context['REGION']
    global_dbs['BASE CASE']
    if (context['_position'] == 0):
        context['sub_strings'][int(context['pointer'])] = context['wstring_in']
        return
    context['END_REGION']
    context['REGION']
    global_dbs['RECURSIVE CASE']
    context['sub_strings'][int(context['pointer'])] = LEFT(IN=context['wstring_in'], L=(context['_position'] - 1))
    WString_Split_Single(wstring_in=RIGHT(IN=context['wstring_in'], L=(LEN(context['wstring_in']) - context['_position'])), delimeter=context['delimeter'], pointer=(context['pointer'] + 1), sub_strings=context['sub_strings'])
    context['END_REGION']
