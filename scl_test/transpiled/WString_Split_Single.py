import math

def WString_Split_Single(context=None, global_dbs=None, **kwargs):
    if context is None: context = {}
    if global_dbs is None: global_dbs = {}
    for k, v in kwargs.items():
        context[k] = v
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
    context['_position'] = FIND(IN1=context['wstring_in'], IN2=context['delimeter'])
    if (context['_position'] == 0):
        context['sub_strings'][int(context['pointer'])] = context['wstring_in']
        return
    context['sub_strings'][int(context['pointer'])] = LEFT(IN=context['wstring_in'], L=(context['_position'] - 1))
    WString_Split_Single(wstring_in=RIGHT(IN=context['wstring_in'], L=(LEN(context['wstring_in']) - context['_position'])), delimeter=context['delimeter'], pointer=(context['pointer'] + 1), sub_strings=context['sub_strings'])
