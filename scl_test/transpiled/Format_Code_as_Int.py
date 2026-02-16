import math

def Format_Code_as_Int(context, global_dbs):
    # Return Type: Int
    # VAR_INPUT:
    #   formatCode: String
    context['Format Code as Int'] = CHAR_TO_INT(STRING_TO_CHAR(LEFT(IN=context['formatCode'], L=1)))
