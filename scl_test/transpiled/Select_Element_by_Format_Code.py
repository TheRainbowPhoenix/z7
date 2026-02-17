import math

def Format_Code_as_Int(context=None, global_dbs=None, **kwargs):
    if context is None: context = {}
    if global_dbs is None: global_dbs = {}
    for k, v in kwargs.items():
        context[k] = v
    # Return Type: Int
    # VAR_INPUT:
    #   formatCode: String
    context['Format Code as Int'] = CHAR_TO_INT(STRING_TO_CHAR(LEFT(IN=context['formatCode'], L=1)))


def Select_Element_by_Format_Code(context=None, global_dbs=None, **kwargs):
    if context is None: context = {}
    if global_dbs is None: global_dbs = {}
    for k, v in kwargs.items():
        context[k] = v
    # Return Type: String
    # VAR_INPUT:
    #   formatCode: String
    #   d&tStrings: Elements as Strings
    # VAR_OUTPUT:
    #   error message: String
    # VAR_TEMP:
    #   ret: String
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
    _case_val_1 = Format_Code_as_Int(context['formatCode'])
    if _case_val_1 == context['Y']:
        context['ret'] = context['d&tStrings'].year
    elif _case_val_1 == context['M']:
        context['ret'] = context['d&tStrings'].month
    elif _case_val_1 == context['D']:
        context['ret'] = context['d&tStrings'].day
    elif _case_val_1 == context['H']:
        context['ret'] = context['d&tStrings'].hour
    elif _case_val_1 == context['I']:
        context['ret'] = context['d&tStrings'].minute
    elif _case_val_1 == context['S']:
        context['ret'] = context['d&tStrings'].second
    else:
        context['error message'] = 'use y for year, m for month, d for day, h for hour, i for minute, or s for second'
    context['Select Element by Format Code'] = context['ret']
