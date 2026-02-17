import math

def Lower(context=None, global_dbs=None, **kwargs):
    if context is None: context = {}
    if global_dbs is None: global_dbs = {}
    for k, v in kwargs.items():
        context[k] = v
    # Return Type: String
    # VAR_INPUT:
    #   string: String
    # VAR_TEMP:
    #   charArr: Array[0..255] of Char
    #   cntChar: UInt
    #   pChar: Int
    #   stringBox: String
    # VAR CONSTANT:
    #   asciiLow: Char
    context['asciiLow'] = 'A'
    #   asciiHigh: Char
    context['asciiHigh'] = 'Z'
    #   asciiCaseOffset: Int
    context['asciiCaseOffset'] = 32
    Strg_TO_Chars(Strg=context['string'], pChars=0, Cnt=context['cntChar'], Chars=context['charArr'])
    for _loop_var_1 in range(int(0), int((UINT_TO_INT(context['cntChar']) - 1)) + 1):
        context['pChar'] = _loop_var_1
        if ((context['asciiLow'] <= context['charArr'][int(context['pChar'])]) and (context['charArr'][int(context['pChar'])] <= context['asciiHigh'])):
            context['charArr'][int(context['pChar'])] = INT_TO_CHAR((CHAR_TO_INT(context['charArr'][int(context['pChar'])]) + context['asciiCaseOffset']))
    Chars_TO_Strg(Chars=context['charArr'], pChars=0, Cnt=context['cntChar'], Strg=context['stringBox'])
    context['Lower'] = context['stringBox']
