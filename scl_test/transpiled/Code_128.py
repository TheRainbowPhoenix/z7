import math

def Code_128(context=None, global_dbs=None, **kwargs):
    if context is None: context = {}
    if global_dbs is None: global_dbs = {}
    for k, v in kwargs.items():
        context[k] = v
    # Return Type: Void
    # VAR_INPUT:
    #   partNumber: String
    # VAR_OUTPUT:
    #   barcode: String
    # VAR:
    #   charsIn: Array[0..255] of Byte
    #   charsOut: Array[0..255] of Byte
    #   cnt: UInt
    #   intVals: Array[0..255] of Int
    context['intVals'] = 104
    #   sum: Int
    #   checkSum: Int
    # VAR_TEMP:
    #   pn: String
    #   i: Int
    # VAR CONSTANT:
    #   startChar: Char
    context['startChar'] = 'Ì'
    #   stopChar: Char
    context['stopChar'] = 'Î'
    context['pn'] = context['partNumber']
    for _loop_var_1 in range(int(0), int(255) + 1):
        context['i'] = _loop_var_1
        context['charsIn'][int(context['i'])] = 0
        context['charsOut'][int(context['i'])] = 0
        context['intVals'][int(context['i'])] = 0
    Strg_TO_Chars(Strg=context['pn'], pChars=0, Cnt=context['cnt'], Chars=context['charsIn'])
    context['sum'] = 104
    for _loop_var_1 in range(int(0), int(UINT_TO_INT((context['cnt'] - 1))) + 1):
        context['i'] = _loop_var_1
        context['intVals'][int(context['i'])] = (CHAR_TO_INT(context['charsIn'][int(context['i'])]) - 32)
        context['intVals'][int(context['i'])] = (context['intVals'][int(context['i'])] * (context['i'] + 1))
        context['sum'] = (context['sum'] + context['intVals'][int(context['i'])])
    context['checkSum'] = ((context['sum'] % 103) + 32)
    if (context['checkSum'] >= 127):
        context['checkSum'] = (context['checkSum'] + 68)
    context['charsOut'][int(0)] = CHAR_TO_BYTE(context['startChar'])
    for _loop_var_1 in range(int(1), int(UINT_TO_INT(context['cnt'])) + 1):
        context['i'] = _loop_var_1
        context['charsOut'][int(context['i'])] = context['charsIn'][int((context['i'] - 1))]
    context['charsOut'][int((context['cnt'] + 1))] = INT_TO_BYTE(context['checkSum'])
    context['charsOut'][int((context['cnt'] + 2))] = CHAR_TO_BYTE(context['stopChar'])
    Chars_TO_Strg(Chars=context['charsOut'], pChars=0, Cnt=(context['cnt'] + 3), Strg=context['barcode'])
