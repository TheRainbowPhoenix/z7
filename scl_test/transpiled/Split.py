import math

def Split(context=None, global_dbs=None, **kwargs):
    if context is None: context = {}
    if global_dbs is None: global_dbs = {}
    for k, v in kwargs.items():
        context[k] = v
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
    context['_position'] = FIND(IN1=context['string_in'], IN2=context['delimeter'])
    if (context['_position'] == 0):
        context['sub_strings'][int(context['pointer'])] = context['string_in']
        return
    context['sub_strings'][int(context['pointer'])] = LEFT(IN=context['string_in'], L=(context['_position'] - 1))
    Split(string_in=RIGHT(IN=context['string_in'], L=(LEN(context['string_in']) - context['_position'])), delimeter=context['delimeter'], pointer=(context['pointer'] + 1), sub_strings=context['sub_strings'])
