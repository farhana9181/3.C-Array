//problem -09
#include <iostream>
using namespace std;
int main()
{
    int f[4]= {10,15,8,12};
    int i,j,asc=0;
    cout<< "There are - "<<endl<<"(10 red apples ), "<<endl<<"(15 green apples ) , "
        <<endl<<"(8 yellow apples) and"<<endl<<"(12 red and yellow mixed colored apples)."<<endl<<endl;
    for(i=0; i<4 ; i++)
    {
        for(j=0; j<4 ; j++)
        {
            if(f[i] > f[j])
            {
                asc=f[i];
                f[i]=f[j];
                f[j]=asc;
            }
        }
    }
    cout<<"**The number of apple in ascending order **="<<endl;
    for(i=0; i<4 ; i++)
    {
        cout<<f[i]<<"\t";
    }
}
