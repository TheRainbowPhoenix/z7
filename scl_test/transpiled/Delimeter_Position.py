import math

def Is_Symbol(context, global_dbs):
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


def Delimeter_Position(context, global_dbs):
    # Return Type: Int
    # VAR_INPUT:
    #   format: String
    # VAR_TEMP:
    #   _format: String
    #   ret: Int
    #   pString: Int
    context['_format'] = context['format']
    context['ret'] = (-1)
    context['pString'] = 1
    while ((not Is_Symbol(STRING_TO_CHAR(LEFT(IN=context['_format'], L=1)))) and (context['pString'] < LEN(context['format']))):
        context['_format'] = RIGHT(IN=context['_format'], L=(LEN(context['_format']) - 1))
        context['pString'] = (context['pString'] + 1)
    if (context['pString'] < LEN(context['format'])):
        context['ret'] = context['pString']
    if ((context['pString'] == LEN(context['format'])) and Is_Symbol(STRING_TO_CHAR(LEFT(IN=context['_format'], L=1)))):
        context['ret'] = context['pString']
    context['Delimeter Position'] = context['ret']
