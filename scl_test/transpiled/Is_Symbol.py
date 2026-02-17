import math

def Is_Symbol(context=None, global_dbs=None, **kwargs):
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
    #   0: Int
    context['0'] = 48
    #   9: Int
    context['9'] = 57
    #   A: Int
    context['A'] = 65
    #   Z: Int
    context['Z'] = 90
    #   _a: Int
    context['_a'] = 97
    #   _z: Int
    context['_z'] = 122
    _case_val_1 = CHAR_TO_INT(context['character'])
    if (_case_val_1 >= context['0'] and _case_val_1 <= context['9']) or (_case_val_1 >= context['A'] and _case_val_1 <= context['Z']) or (_case_val_1 >= context['_a'] and _case_val_1 <= context['_z']):
        context['ret'] = False
    else:
        context['ret'] = True
    context['Is Symbol'] = context['ret']
