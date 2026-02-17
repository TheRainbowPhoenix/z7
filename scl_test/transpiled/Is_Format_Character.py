import math

def Is_Format_Character(context=None, global_dbs=None, **kwargs):
    if context is None: context = {}
    if global_dbs is None: global_dbs = {}
    for k, v in kwargs.items():
        context[k] = v
    # Return Type: Bool
    # VAR_INPUT:
    #   character: Char
    # VAR_TEMP:
    #   ret: Bool
    # VAR CONSTANT:
    #   Y: Int
    context['Y'] = 89
    #   M: Int
    context['M'] = 77
    #   D: Int
    context['D'] = 68
    #   H: Int
    context['H'] = 72
    #   I: Int
    context['I'] = 73
    #   S: Int
    context['S'] = 83
    _case_val_1 = CHAR_TO_INT(context['character'])
    if _case_val_1 == context['Y'] or _case_val_1 == context['M'] or _case_val_1 == context['D'] or _case_val_1 == context['H'] or _case_val_1 == context['I'] or _case_val_1 == context['S']:
        context['ret'] = True
    else:
        context['ret'] = False
    context['Is Format Character'] = context['ret']
