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
