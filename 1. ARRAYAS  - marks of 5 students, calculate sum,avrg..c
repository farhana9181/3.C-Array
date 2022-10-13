//ARRAYAS  - marks of 5 students, calculate sum, avrg .
#include<stdio.h>
void main()
{   int i;
    float marks[5], sum=0.0;
    float avrg;
    printf("Enter the marks number = \n");
    for( i=0 ; i<5 ; i++)
    {
        printf("marks[%d] =", i);
        scanf("%f",&marks[i]);
    }
    printf("Marks of the elements are = \n");
    for( i=0 ; i<5 ; i++)
    {
        printf("%f\t ", marks[i]);
    }
    for( i=0 ; i<5 ; i++)
    {
        sum = sum + marks[i];
    }
    avrg = sum/5;
    printf("\nThe Addition of  total number is  = %f\n", sum);
    printf("The average marks of  student is  =%.2f\n", avrg);
}
