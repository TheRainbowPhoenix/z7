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


def Format_Output(context=None, global_dbs=None, **kwargs):
    if context is None: context = {}
    if global_dbs is None: global_dbs = {}
    for k, v in kwargs.items():
        context[k] = v
    # Return Type: Void
    # VAR_INPUT:
    #   formatCodes: String Buffer
    #   delimeters: String Buffer
    #   d&tStrings: Elements as Strings
    # VAR_OUTPUT:
    #   date & time as string: String
    #   error message: String
    # VAR_TEMP:
    #   pCodes: Int
    #   ret: String
    #   retError: String
    for _loop_var_1 in range(int(0), int(9) + 1):
        context['pCodes'] = _loop_var_1
        if (context['formatCodes'].me[int(context['pCodes'])] != ''):
            context['ret'] = CONCAT_STRING(IN1=context['ret'], IN2=Select_Element_by_Format_Code(formatCode=context['formatCodes'].me[int(context['pCodes'])], d_and_tStrings=context['d&tStrings'], error_message=context['retError']))
        if (context['retError'] != ''):
            return
        if (context['delimeters'].me[int(context['pCodes'])] != ''):
            context['ret'] = CONCAT_STRING(IN1=context['ret'], IN2=context['delimeters'].me[int(context['pCodes'])])
    context['date & time as string'] = context['ret']
    context['error message'] = context['retError']
